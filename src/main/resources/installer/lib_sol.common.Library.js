//@include lib_sol.common.Instance.js

/**
 * @class sol.common.Instance
 * @extends sol.Base
 * @singleton
 *
 * This class provides basic functionality to create javascript Instances.
 *
 * @author  ELO Digital Office GmbH
 * @version 0.00.001
 *
 * @eloall
 */

sol.common.instance.define("sol.common.library.promise", {
  singleton: true,

  create: function (fn) {
    function Promise() {
      var me = this,
          deferreds = [],
          next = null,
          handler = {
            then: function (onFulfilled, onRejected) {
              next = new sol.common.library.Promise();
              deferreds.push({
                onFulfilled: onFulfilled,
                onRejected: onRejected,
                promise: next
              });
              return next;
            },
            resolve: function (value) {
              resolve(value);
            },
            reject: function (reason) {
              reject(reason);
            }
          },
          setTimeout = function (timeoutFunction, delay) {
            // TODO implement set timeout with use of JAVA
            (new java.util.Timer()).schedule(new JavaAdapter(java.util.TimerTask, { run: timeoutFunction }), delay);
          };

      if (!(me instanceof sol.common.library.Promise)) {
        throw "Promises must be constructed via new";
      }
      if (typeof fn !== "function") {
        return handler;
      }
      setTimeout(tryResolve, 0);

      return handler;
      function tryResolve() {
        var executedOnce = false,
            executeIf = function (resolver, guard) {
              return function (value) {
                if (guard) {
                  return;
                }
                guard = true;
                resolver(value);
              }.bind(me);
            };
        try {
          fn(
            executeIf(resolve, executedOnce),
            executeIf(reject, executedOnce)
          );
        } catch (ex) {
          executeIf(reject, executedOnce)(ex);
        }
      }
      function reject(reason) {
        finalize(2, reason);
      }
      function resolve(value) {
        try {
          if (value == me) {
            throw "A promise cannot be resolved with itself.";
          }
          if (value && (typeof value === 'object' || typeof value === 'function')) {
            if (value instanceof sol.common.library.Promise) {
              finalize(3, value);
              return;
            } else if (typeof value.then === 'function') {
              // TODO
              // doResolve(bind(then, newValue), self);
              return;
            }
          }
          finalize(1, value);
        } catch (ex) {
          reject(ex);
        }
      }
      function finalize(state, value, isRetry) {
        if (deferreds.length === 0 && !isRetry) {
          setTimeout(function () {
            finalize(state, value, true);
          }, 0);
        }

        for (var i = 0, len = deferreds.length; i < len; i++) {
          handle(deferreds[i], value, state);
        }
        deferreds = [];
      }
      function handle(deferred, value, state) {
        var result, callback;
        if (!state) {
          return;
        }
        try {
          callback = state === 1 ? deferred.onFulfilled : deferred.onRejected;
          result = callback(value);
          next.resolve(result);
        } catch (ex) {
          next.reject(ex);
        }
      }
    }
  }
});