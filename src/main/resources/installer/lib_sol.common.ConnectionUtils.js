

importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js

/**
 * This class provides basic provider for ix (admin) connections.
 *
 * @class sol.common.ix.ConnectionUtils
 * @singleton
 * @eloix
 *
 */
sol.define("sol.common.IxConnectionUtils", {

  singleton: true,

  /**
   * Returns `ixConnectAdmin` connection object as soon it is defined.
   * Otherwise usually `ixConnect` object will be returned
   * @param {Boolean} asAdmin If `true` and admin context is available it will be returned ixConnectAdmin
   */
  getConnection: function (asAdmin) {
    return ((asAdmin == true && typeof ixConnectAdmin !== "undefined")) ? ixConnectAdmin : ixConnect;
  },

  /**
   * Change temporary timeZone of the current ixConnection.
   *
   * It is important that you restore the timeZone of the connection when you don't use
   * it anymore
   *
   * var timeZoneEvent = sol.common.IxConnectionUtils.useTemporaryTimeZone(timeZone);
   * ...
   * timeZoneEvent.restore()
   *
   *
   * @param {String} timeZone
   * @returns
   */
  useTimeZone: function (timeZone) {
    var me = this, savedTimeZone, connection;

    connection = me.getConnection();
    savedTimeZone = ixConnect.loginResult.clientInfo.timeZone;

    connection.loginResult.clientInfo.timeZone = timeZone;
    return {
      savedTimeZone: savedTimeZone,
      restore: function () { // return callback to restore timeZone of the connection
        me.logger.debug("restore ixConnect timeZone ", savedTimeZone);
        connection.loginResult.clientInfo.timeZone = savedTimeZone;
      }
    };
  },

  /**
   * @returns current logged in user
   */
  getCurrentUser: function () {
    return ixConnect && ixConnect.loginResult.user;
  }

});