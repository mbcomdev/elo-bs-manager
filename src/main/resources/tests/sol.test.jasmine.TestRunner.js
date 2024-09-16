

//@include lib_Class.js
//@include lib_sol.common.StringUtils.js

/**
 * Please consider to move the following variables to your eslint config
 */
/* jasmine variables */
/* global jasmine, describe, beforeAll, beforeEach, afterEach, afterAll, it, expect */
/* test variables */
/* global ConnectionHandler, TestUtils */
/* business solution variables */
/* global sol */

describe("lib_sol.common.StringUtils", function () {
  var originalTimeout;

    it("should be truncate after 5 characters", function () {
       expect("Hello...").toEqual("Hello...");
    });

      it("should be truncate after 10 characters", function () {
           expect("Hello..").toEqual("Hello...");
        });
 });