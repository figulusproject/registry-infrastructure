package lib

import (
	_ "embed"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/dop251/goja"
	"github.com/dop251/goja_nodejs/eventloop"
)

//go:generate bash -c "cp ../validator-bundled.js validator-bundled.js"

//go:embed validator-bundled.js
var validatorBundle string

// ValidateRegistryChanges validates registry changes using the bundled validator
func ValidateRegistryChanges(changedFiles []string, author string, repoRoot string, settingsJSON string) (*ValidationSummary, error) {
	// Start the event loop
	loop := eventloop.NewEventLoop()
	loop.Start()
	defer loop.Stop()

	// Parse localUsername from settingsJSON
	localUsername := "admin"
	var settings map[string]interface{}
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err == nil {
		if username, ok := settings["localUsername"].(string); ok {
			localUsername = username
		}
	}

	// Variables to store setup results
	var validateFn goja.Callable
	var setupErr error
	setupDone := make(chan struct{})

	// First RunOnLoop: all setup happens on the loop's internal vm
	loop.RunOnLoop(func(vm *goja.Runtime) {
		defer close(setupDone)

		// Inject settings as a global
		vm.Set("__goSettings", settingsJSON)

		// Inject helpers
		if err := InjectHelpers(vm, repoRoot, localUsername); err != nil {
			setupErr = fmt.Errorf("failed to inject helpers: %w", err)
			return
		}

		// Run the bundle
		if _, err := vm.RunString(validatorBundle); err != nil {
			setupErr = fmt.Errorf("failed to run bundle: %w", err)
			return
		}

		// Get the validateRegistryChanges function
		var ok bool
		validateFn, ok = goja.AssertFunction(vm.Get("validateRegistryChanges"))
		if !ok {
			setupErr = fmt.Errorf("validateRegistryChanges is not a function")
			return
		}
	})

	// Wait for setup to complete
	<-setupDone

	// Check for setup errors
	if setupErr != nil {
		return nil, setupErr
	}

	// Create channels for result and error
	resultCh := make(chan string, 1)
	errCh := make(chan error, 1)

	// Second RunOnLoop: call the validation function
	loop.RunOnLoop(func(vm *goja.Runtime) {
		// Call the JS function
		changedFilesArray := vm.NewArray()
		for i, file := range changedFiles {
			changedFilesArray.Set(fmt.Sprintf("%d", i), vm.ToValue(file))
		}

		promise, err := validateFn(goja.Undefined(), changedFilesArray, vm.ToValue(author))
		if err != nil {
			errCh <- fmt.Errorf("failed to call validateRegistryChanges: %w", err)
			return
		}

		// Convert to promise if needed
		promiseObj := promise.(*goja.Object)

		// Set up .then() handler
		thenFn, ok := goja.AssertFunction(promiseObj.Get("then"))
		if !ok {
			errCh <- fmt.Errorf("promise.then is not a function")
			return
		}

		// Success callback
		successCallback := vm.ToValue(func(call goja.FunctionCall) goja.Value {
			if len(call.Arguments) > 0 {
				resultCh <- call.Arguments[0].String()
			} else {
				errCh <- fmt.Errorf("validation returned no result")
			}
			return goja.Undefined()
		})

		// Error callback
		errorCallback := vm.ToValue(func(call goja.FunctionCall) goja.Value {
			if len(call.Arguments) > 0 {
				errCh <- fmt.Errorf("validation error: %v", call.Arguments[0])
			} else {
				errCh <- fmt.Errorf("validation error: unknown error")
			}
			return goja.Undefined()
		})

		// Attach callbacks
		_, err = thenFn(promiseObj, successCallback, errorCallback)
		if err != nil {
			errCh <- fmt.Errorf("failed to attach then handler: %w", err)
			return
		}
	})

	// Wait for result or timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	select {
	case result := <-resultCh:
		// Parse the JSON result
		var summary ValidationSummary
		if err := json.Unmarshal([]byte(result), &summary); err != nil {
			return nil, fmt.Errorf("failed to parse validation result: %w", err)
		}
		return &summary, nil
	case err := <-errCh:
		return nil, err
	case <-ctx.Done():
		return nil, fmt.Errorf("validation timeout: exceeded 30 seconds")
	}
}
