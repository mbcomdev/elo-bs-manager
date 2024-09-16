/**
 * ELO Test Connection Handler
 *
 * @author ELO Digital Office GmbH
 *
 */
/* eslint-disable quotes */
importPackage(Packages.de.elo.ix.client);
importPackage(Packages.java.io);

(function (global, args) {
    log.info("CHONFsdfjklsghsdjklghkjld")
  function ConnectionHandler() {
    var connectionHandler,
        connectionFactory,
        ixConnect,
        ixConnectAdmin,
        $ENV;


        connectionHandler = {
            connectIx: function() {
                return connectionHandler._connectIx(
                    "http://heimplatz-meeting.dev.elo/ix-Solutions/ix",
                    "0",
                    "elo",
                    "en"
                )
            },
            _connectIx: function (ixUrl, username, password, language) {
                log.info("Connect to IX: {}", ixUrl);
                log.info("User name: {}", username);
                log.info("Computer name: {}", ($ENV || {}).COMPUTERNAME || "unknown");
                log.info("Language: {}", language);

                if (ixConnect) {
                  ixConnect.close();
                }

                connectionFactory = new IXConnFactory(ixUrl, "ELO Test Runner Script", "1.0");

                ixConnect = connectionFactory.create(username, password, ($ENV || {}).COMPUTERNAME || "unknown", null);
                ixConnect.loginResult.clientInfo.language = language;
                global.ixConnect = ixConnect;

                ixConnectAdmin = connectionFactory.createAdmin(username, password, ($ENV || {}).COMPUTERNAME || "unknown", null);
                ixConnectAdmin.loginResult.clientInfo.language = language;
                global.ixConnectAdmin = ixConnectAdmin;

                return ixConnect;
            }
        }
        return connectionHandler;
  }

  log.info("test test")
  global.ConnectionHandler = ConnectionHandler();
})(this)