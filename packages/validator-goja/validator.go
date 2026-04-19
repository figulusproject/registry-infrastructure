package main

import (
	_ "embed"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/dop251/goja"
	"github.com/dop251/goja_nodejs/eventloop"
)

//go:embed validator-bundled.js
var validatorBundle string

// ValidateRegistryChanges validates registry changes using the bundled validator
func ValidateRegistryChanges(changedFiles []string, author string, repoRoot string, settingsJSON string) (*ValidationSummary, error) {
	// Create a new Goja runtime
	rt := goja.New()

	// Start the event loop
	loop := eventloop.NewEventLoop()
	loop.Start()
	defer loop.Stop()

	// Inject settings as a global
	rt.Set("__goSettings", settingsJSON)

	// Parse localUsername from settingsJSON
	localUsername := "admin"
	var settings map[string]interface{}
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err == nil {
		if username, ok := settings["localUsername"].(string); ok {
			localUsername = username
		}
	}

	// Inject helpers
	if err := injectHelpers(rt, repoRoot, localUsername); err != nil {
		return nil, fmt.Errorf("failed to inject helpers: %w", err)
	}

	// Run the bundle
	if _, err := rt.RunString(validatorBundle); err != nil {
		return nil, fmt.Errorf("failed to run bundle: %w", err)
	}

	// Get the validateRegistryChanges function
	validateFn, ok := goja.AssertFunction(rt.Get("validateRegistryChanges"))
	if !ok {
		return nil, fmt.Errorf("validateRegistryChanges is not a function")
	}

	// Create channels for result and error
	resultCh := make(chan string, 1)
	errCh := make(chan error, 1)

	// Run the validation in the event loop
	loop.RunOnLoop(func(vm *goja.Runtime) {
		// Call the JS function
		changedFilesArray := rt.NewArray()
		for i, file := range changedFiles {
			changedFilesArray.Set(fmt.Sprintf("%d", i), rt.ToValue(file))
		}

		promise, err := validateFn(goja.Undefined(), changedFilesArray, rt.ToValue(author))
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
		successCallback := rt.ToValue(func(call goja.FunctionCall) goja.Value {
			if len(call.Arguments) > 0 {
				resultCh <- call.Arguments[0].String()
			} else {
				errCh <- fmt.Errorf("validation returned no result")
			}
			return goja.Undefined()
		})

		// Error callback
		errorCallback := rt.ToValue(func(call goja.FunctionCall) goja.Value {
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
