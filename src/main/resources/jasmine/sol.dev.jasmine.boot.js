//@include sol.dev.jasmine.js

/*
Copyright (c) 2008-2015 Pivotal Labs

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
// eslint-disable-next-line no-use-before-define
var jasmineRequire = jasmineRequire || {},
    // eslint-disable-next-line no-use-before-define
    catchingExceptions = catchingExceptions || false,
    jasmine = jasmineRequire.core(jasmineRequire);

/*
 * Provide missing globals for jasmine when running under rhino
 *
 * based on:
 * https://github.com/activelylazy/Rescripter/blob/master/javascript/script/rescripter/jasmine-rhino.js
 */
(function (global) {
  var timer = new java.util.Timer(),
      counter = 1,
      ids = {};

  function isFunction(obj, attribute) {
    return obj && obj[attribute] && typeof obj[attribute] == "function";
  }

  global.setTimeout = function (fn, delay) {
    var id = counter++;
    ids[id] = new JavaAdapter(java.util.TimerTask, { run: fn });
    timer.schedule(ids[id], delay);
    return id;
  };

  global.clearTimeout = function (id) {
    if (isFunction(ids[id], "cancel")) {
      ids[id].cancel();
    }
    timer.purge();
    delete ids[id];
  };

  global.setInterval = function (fn, delay) {
    var id = counter++;
    ids[id] = new JavaAdapter(java.util.TimerTask, { run: fn });
    timer.schedule(ids[id], delay, delay);
    return id;
  };

  global.clearInterval = global.clearTimeout;

  global.canQuit = false;

  // global.exports = {};

  global.onload = function () {
    jasmine.getEnv().execute();
    // eslint-disable-next-line no-undef
    var quit;
    if (quit && typeof quit == "function") {
      // eslint-disable-next-line no-undef
      setInterval(function () {
        if (global.canQuit) {
          quit();
        }
      }, 100);
    }
  };
})(this);

/**
 * Jasmine boot in Nashorn (Rhino)
 */
(function (global) {
  function extend(destination, source) {
    for (var property in source) {
      destination[property] = source[property];
    }
    return destination;
  }

  function setEnv(env, config) {
    env.catchExceptions(typeof config.catchingExceptions === "undefined" ? true : config.catchingExceptions);
    env.throwOnExpectationFailure(config.throwingExpectationFailures);
    env.randomizeTests(config.random);
    if (config.seed) {
      env.seed(config.seed);
    }
  }

  function FileLogReporter() {

  }

  function LogReporter() {
    var summary = {
          passedExpectations: 0,
          failedExpectations: 0,
          failedExpectationsMessages: [

          ]
        },
        jasmineInfo;

    return {
      jasmineStarted: function (_jasmineInfo) {
        jasmineInfo = _jasmineInfo;
        log.info('Running suite with ' + jasmineInfo.totalSpecsDefined + " total specifications defined.");
      },
      suiteStarted: function (result) {
        // log.info('Suite started: ' + result.description + ' | ' + result.fullName);
      },
      specStarted: function (result) {
        // log.info('Specification started: ' + result.description + ' | ' + result.fullName);
      },
      specDone: function (result) {
        log.info('Specification: "' + result.description + '" was ' + result.status);
        for (var i = 0; i < result.failedExpectations.length; i++) {
          log.info('Failure: ' + result.failedExpectations[i].message);
          log.info('stack trace:');
          log.info(result.failedExpectations[i].stack);
          summary.failedExpectationsMessages.push({
            description: result.description,
            message: result.failedExpectations[i].message,
            stack: result.failedExpectations[i].stack ? result.failedExpectations[i].stack : "---"
          });
        }
        log.info('Passed expectations: ' + result.passedExpectations.length);
        summary.passedExpectations += result.passedExpectations.length;
        summary.failedExpectations += result.failedExpectations.length;
      },
      suiteDone: function (result) {
        log.info('Suite: ' + result.description + ' was ' + result.status);
      },
      jasmineDone: function () {
      if (summary.failedExpectations > 0) {
                log.info('############################################################');
                log.info('######################### WARNING ##########################');
                log.info('############################################################');
                log.info("");
                log.info("Failed expectations messages:");
                summary
                  .failedExpectationsMessages
                  .forEach(function (failedExpectation) {
                    log.info("");
                    log.info("failedExpectation : " + failedExpectation.description);
                    log.info("message           : " + failedExpectation.message);
                    log.info("stack             : " + failedExpectation.stack);
                    log.info("");
                  });
       }
        summary.totalExpectations = summary.passedExpectations + summary.failedExpectations;
        out.lifecycle("");
        out.lifecycle("");
        out.lifecycle('######################### SUMMARY ##########################');
        out.lifecycle("");
        out.lifecycle('Total specs defined  : ' + jasmineInfo.totalSpecsDefined);
        out.lifecycle('Total expectations   : ' + summary.totalExpectations);
        out.lifecycle('Passed expectations  : ' + summary.passedExpectations);
        out.lifecycle('Failed expectations  : ' + summary.failedExpectations);
        out.lifecycle("");

        testResult.setSuccess(summary.passedExpectations)
        testResult.setFailed(summary.failedExpectations)

        log.info('############################################################');
        global.canQuit = true;
      }
    };
  }

  var env = jasmine.getEnv(),
      jasmineInterface = jasmineRequire.interface(jasmine, env),
      throwingExpectationFailures = false,
      random = false,
      seed = false;

  extend(global, jasmineInterface);

  setEnv(env, {
    catchingExceptions: catchingExceptions,
    throwingExpectationFailures: throwingExpectationFailures,
    random: random,
    seed: seed
  });

  env.addReporter(LogReporter());
}(this));
