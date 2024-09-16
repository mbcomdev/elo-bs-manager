
//@include lib_Class.js

/**
 * Helper functions for asynchronous IX processing
 *
 * @author MW, ELO Digital Office GmbH
 * @version 1.0
 *
 * @elojc
 * @eloas
 * @eloix
 */
sol.define("sol.common.AsyncUtils", {
  singleton: true,

  /**
   * Wait until a background job is finished
   * @param {String} jobId Job ID of the background job
   * @param {config} config Configuration
   * @param {de.elo.ix.client.IXConnection} config.connection Index server connection
   * @param {Number} config.interval Interval in milliseconds
   * @return {de.elo.ix.client.JobState}
   */
  waitForJob: function (jobId, config) {
    var jobState, conn;
    config = config || {};
    conn = config.connection || ixConnect;
    config.interval = config.interval || 200;
    jobState = conn.ix().queryJobState(jobId, true, true, true);
    while (jobState && jobState.jobRunning) {
      Packages.java.lang.Thread.sleep(config.interval);
      jobState = conn.ix().queryJobState(jobId, true, true, true);
    }
    return jobState;
  }
});
