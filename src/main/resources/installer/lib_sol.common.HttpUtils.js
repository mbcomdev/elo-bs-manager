
//@include lib_Class.js

/**
 * HTTP request utilities
 *
 * @author ELO Digital Office GmbH
 *
 * @eloas
 * @eloix
 * @elojc
 *
 * @requires sol.common.WfUtils
 * @requires sol.common.AsUtils
 */
sol.define("sol.common.HttpUtils", {
  singleton: true,

  /**
   * Sends a HTTP request.
   *
   * Example:
   *
   *     var responseObj = sol.common.HttpUtils.sendRequest({
   *       url: "{{eloWfBaseUrl}}/apps/rest/cmd/app/deploy",
   *       method: "post",
   *       connectTimeout: 10000,
   *       readTimeout: 60000,
   *       contentType: "application/json;charset=UTF-8",
   *       params: { Key2: "Value2" },
   *       addTicket: true,
   *       cookies: { Key1: "Value1" },
   *       addCookieTicket: true
   *     });
   *
   *    var responseObj = sol.common.HttpUtils.sendRequest({
   *       url: "https://example.com"
   *       trustAllHosts: true,
   *       trustAllCerts: true
   *    });
   *
   * URL placeholders:
   *
   *     {{eloWfBaseUrl}} ELOwf base URL
   *     {{eloAsBaseUrl}} ELOas base URL
   *     {{ticket}} ELO authorization ticket
   *
   * Response object:
   *
   *     {
   *       "responseCode": 200,
   *       "responseOk": true,
   *       "content": "",
   *       "errorMessage": ""
   *     }
   *
   * @param {Object} config HTTP request configuration object
   * @param {String} config.url URL
   * @param {String} [config.method=get] Request method, e.g. `get`, `post` , `put` or `delete`
   * @param {String} config.connectTimeout Connect timeout
   * @param {String} config.readTimeout Read timeout
   * @param {String} config.contentType Content type
   * @param {String} config.user User name
   * @param {String} config.password Password
   * @param {String} [config.authType=Basic] Authentification type
   * @param {Object} config.params Map of key-value pairs which will be submitted as HTTP parameters
   * @param {String} config.addTicket. If true the ELO authorization ticket will be added as HTTP parameter
   * @param {Object} config.cookies Map of key-value pairs which will be added as cookies
   * @param {Object} config.data Data
   * @param {Boolean} [config.encodeData=true] Encode data
   * @param {Object} config.dataObj Data object
   * @param {String} config.addCookieTicket. If true the ELO authorization ticket will be added as cookie
   * @param {Object} config.requestProperties Request properties
   * @param {Boolean} config.resolve Enrich the URL with specific variables (`{{eloWfBaseUrl}}`, `{{ticket}}`) and given parameters
   * @param {String} config.proxyHost Proxy host
   * @param {String} config.proxyPort Proxy port
   * @return {java.net.HttpURLConnection} httpConn. HTTP connection
   * @return {Object} HTTP response object
   */
  sendRequest: function (config) {
    var me = this,
        result;

    config = config || {};
    config.url += "";
    config.resolve = (typeof config.resolve != "undefined") ? config.resolve : !!config.params || (config.url.indexOf("{{") > -1);
    config.encodeData = (typeof config.encodeData == "undefined") ? true : config.encodeData;
    config.method = (config.method || "").toLowerCase();

    switch (config.method) {
      case "post":
        result = me.sendPost(config.url, config);
        break;
      case "put":
        result = me.sendPost(config.url, config);
        break;
      case "get":
        result = me.sendGet(config.url, config);
        break;
      case "delete":
        result = me.sendDelete(config.url, config);
        break;
      default:
        result = me.sendGet(config.url, config);
    }
    return result;
  },

  /**
   * Sends a HTTP-GET request
   * @private
   * @param {String} urlString URL
   * @param {Object} config HTTP request configuration object
   * @return {Object} Response object
   */
  sendGet: function (urlString, config) {
    var me = this,
        urlConn, resultObj;

    config = config || {};

    if (config.resolve) {
      urlString = me.resolveUrl(urlString, config);
    }
    resultObj = me.buildResultObj(urlString);

    try {
      urlConn = me.prepareRequest(urlString, config);
      urlConn.requestMethod = "GET";
      urlConn.connect();
      me.readResponse(urlConn, resultObj);
    } catch (ex) {
      resultObj.errorMessage = ex;
      me.logger.warn(["Exception while HttpGet: {0}", ex]);
    } finally {
      if (urlConn) {
        urlConn.disconnect();
      }
    }

    return resultObj;
  },

  /**
   * Sends a HTTP-POST request
   * @private
   * @param {String} urlString URL
   * @param {Object} config HTTP request configuration object
   * @return {Object} Response object
   */
  sendPost: function (urlString, config) {
    var me = this,
        urlConn, outputStream, resultObj, encodeData, data;

    config = config || {};


    if (config.dataObj) {
      config.contentType = "application/json;charset=UTF-8";
      config.data = JSON.stringify(config.dataObj);
    }
    
    if (config.resolve) {
      urlString = me.resolveUrl(urlString, config);
    }
    resultObj = me.buildResultObj(urlString);

    data = config.data;
    try {
      urlConn = me.prepareRequest(urlString, config);
      data = data || "";
      if (config.encodeData) {
        encodeData = java.net.URLEncoder.encode(data, "UTF-8");
      } else {
        encodeData = new java.lang.String(data);
      }

      urlConn.doOutput = true;
      urlConn.requestMethod = config.method.toUpperCase();
      urlConn.connect();
      outputStream = urlConn.outputStream;
      outputStream.write(encodeData.getBytes("UTF-8"));
      outputStream.close();
      me.readResponse(urlConn, resultObj);
    } catch (ex) {
      resultObj.errorMessage = ex;
      me.logger.warn(["Exception while HttpPost: {0}", ex]);
    } finally {
      if (urlConn) {
        urlConn.disconnect();
      }
    }
    return resultObj;
  },

  sendDelete: function (urlString, config) {
    var me = this,
        urlConn, resultObj;

    config = config || {};

    if (config.resolve) {
      urlString = me.resolveUrl(urlString, config);
    }
    resultObj = me.buildResultObj(urlString);

    try {
      urlConn = me.prepareRequest(urlString, config);
      urlConn.requestMethod = "DELETE";
      urlConn.connect();
      me.readResponse(urlConn, resultObj);
    } catch (ex) {
      resultObj.errorMessage = ex;
      me.logger.warn(["Exception while HttpDelete: {0}", ex]);
    } finally {
      if (urlConn) {
        urlConn.disconnect();
      }
    }
    return resultObj;
  },

  /**
   * @private
   * Prepares a HTTP request
   * @param {String} urlString URL
   * @param {Object} config HTTP request configuration object
   * @return {java.net.HttpURLConnection}
   */
  prepareRequest: function (urlString, config) {
    var me = this,
        cookiesArr = [],
        url, urlObj, proxy, urlConn, userpass, basicAuth, key, trustManager, sslContext, value,
        connectTimeout, readTimeout;

    url = urlString;
    urlObj = new java.net.URL(url);

    if (config.proxyHost) {
      proxy = new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress(config.proxyHost, config.proxyPort));
      urlConn = urlObj.openConnection(proxy);
    } else {
      urlConn = urlObj.openConnection();
    }

    connectTimeout = java.lang.Integer.valueOf(config.connectTimeout || 10000);
    readTimeout = java.lang.Integer.valueOf(config.readTimeout || 60000);

    urlConn.setConnectTimeout(connectTimeout);
    urlConn.setReadTimeout(readTimeout);

    if (config.contentType) {
      urlConn.setRequestProperty("Content-Type", config.contentType);
    }
    if (config.user) {
      if (config.authType == "NTLM") {
        java.net.Authenticator.default = new JavaAdapter(java.net.Authenticator, {
          getPasswordAuthentication: function () {
            return new java.net.PasswordAuthentication(config.user, java.lang.String(config.password).toCharArray());
          }
        });
      } else {
        userpass = java.lang.String(config.user + ":" + config.password);
        basicAuth = "Basic " + me.encodeBase64(userpass);
        urlConn.setRequestProperty("Authorization", basicAuth);
      }
    }

    if (config.requestProperties) {
      for (key in config.requestProperties) {
        value = config.requestProperties[key];
        urlConn.setRequestProperty(key, value);
      }
    }

    if (config.addCookieTicket) {
      config.cookies = config.cookies || {};
      config.cookies.ticket = ixConnect.loginResult.clientInfo.ticket;
    }

    if (config.cookies) {
      for (key in config.cookies) {
        cookiesArr.push(key + "=" + config.cookies[key]);
      }
      urlConn.setRequestProperty("Cookie", cookiesArr.join("; "));
    }

    // Avoid SSL exception:
    //   javax.net.ssl.SSLHandshakeException: java.security.cert.CertificateException: No name matching <hostname> found
    if (urlConn.defaultHostnameVerifier && config.trustAllHosts) {
      urlConn.hostnameVerifier = new javax.net.ssl.HostnameVerifier({
        verify: function (hostname, session) {
          return true;
        }
      });
    }

    // Avoid SSL exception:
    //   javax.net.ssl.SSLHandshakeException: sun.security.validator.ValidatorException: PKIX path building failed:
    //   sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target
    if (urlConn.defaultSSLSocketFactory && config.trustAllCerts) {
      trustManager = new javax.net.ssl.X509TrustManager({
        checkClientTrusted: function (chain, authType) {
        },

        checkServerTrusted: function (chain, authType) {
        },

        getAcceptedIssuers: function () {
          return null;
        }
      });

      sslContext = javax.net.ssl.SSLContext.getInstance("SSL");
      sslContext.init(null, [trustManager], new java.security.SecureRandom());
      urlConn.SSLSocketFactory = sslContext.socketFactory;
    }

    me.logRequestProperties(urlConn);

    return urlConn;
  },

  /**
   * @private
   * @param {java.net.HttpURLConnection} urlConn
   */
  logRequestProperties: function (urlConn) {
    var me = this,
        requestProperties, entrySetIterator, entrySet, requestPropertyName, requestPropertyValueList, requestPropertyValues,
        headerValueListIterator, requestPropertyValue;

    if (me.logger.debugEnabled) {
      me.logger.debug("Request properties:");
      requestProperties = urlConn.requestProperties;
      entrySetIterator = requestProperties.entrySet().iterator();
      while (entrySetIterator.hasNext()) {
        entrySet = entrySetIterator.next();
        requestPropertyName = entrySet.key;
        requestPropertyValueList = entrySet.value;
        requestPropertyValues = [];
        headerValueListIterator = requestPropertyValueList.iterator();
        while (headerValueListIterator.hasNext()) {
          requestPropertyValue = headerValueListIterator.next() + "";
          requestPropertyValues.push(requestPropertyValue);
        }
        me.logger.debug(requestPropertyName + ": " + requestPropertyValues.join(";"));
      }
    }
  },

  /**
   * @private
   * @return {javax.mail.PasswordAuthentication}
   */
  getPasswordAuthentication: function () {
    var me = this,
        authenticator;

    authenticator = new javax.mail.PasswordAuthentication(me.user, me.password);
    return authenticator;
  },

  /**
   * Resolves an URL
   *
   * @param {String} urlString URL
   * @param {Object} config HTTP request configuration object
   * @return {String} URL
   */
  resolveUrl: function (urlString, config) {
    var ticket, wfBaseUrl, asBaseUrl, key,
        paramArr = [];

    config = config || {};

    ticket = ixConnect.loginResult.clientInfo.ticket;
    urlString += "";

    if (urlString.indexOf("{{eloWfBaseUrl}}") > -1) {
      wfBaseUrl = sol.common.WfUtils.getWfBaseUrl();
      urlString = urlString.replace("{{eloWfBaseUrl}}", wfBaseUrl);
    }
    if (urlString.indexOf("{{eloAsBaseUrl}}") > -1) {
      asBaseUrl = sol.common.AsUtils.getAsBaseUrl();
      urlString = urlString.replace("{{eloAsBaseUrl}}", asBaseUrl);
    }

    if (config) {
      if (config.params) {
        for (key in config.params) {
          paramArr.push(encodeURI(key) + "=" + encodeURI(config.params[key]));
        }
      }
      if (config.addTicket) {
        paramArr.push("ticket=" + ticket);
      }
    }

    if (paramArr.length > 0) {
      urlString += "?" + paramArr.join("&");
    }
    urlString = urlString.replace("{{ticket}}", ticket);
    return urlString;
  },

  /**
   * @private
   * Builds a response object
   * @param {String} url URL
   * @return {Object} Response object
   */
  buildResultObj: function (url) {
    var resultObj, logUrl;

    url += "";
    logUrl = url.replace(/(ticket=\w{7})\w+/, "$1...");
    resultObj = { url: logUrl, responseOk: false };
    return resultObj;
  },

  /**
   * @private
   * Read HTTP response
   * @param {java.net.HttpURLConnection} urlConn HTTP connection
   * @param {Object} resultObj Result object
   */
  readResponse: function (urlConn, resultObj) {
    var me = this;

    resultObj.responseCode = urlConn.responseCode;
    if ((urlConn.responseCode >= java.net.HttpURLConnection.HTTP_OK) && (urlConn.responseCode <= java.net.HttpURLConnection.HTTP_PARTIAL)) {
      resultObj.responseOk = true;
      resultObj.content = me.inputStreamToString(urlConn.inputStream);
    } else {
      resultObj.responseOk = false;
      resultObj.content = me.inputStreamToString(urlConn.errorStream);
      resultObj.errorMessage = "HTTP status code " + resultObj.responseCode;
    }
  },

  /**
   * @private
   * Converts the content of an input stream into a string
   * @param {java.io.InputStream} inputStream Input Stream
   * @return {String} Content as string
   */
  inputStreamToString: function (inputStream) {
    if (!inputStream) {
      return "";
    }
    var content = String(Packages.org.apache.commons.io.IOUtils.toString(inputStream, "UTF-8"));
    inputStream.close();
    return content;
  },

  /**
   * Returns a Base64 encoded string
   * @param {String} str String
   * @return {String} Base64 encoded string
   */
  encodeBase64: function (str) {
    var me = this,
        srcBytes, base64Bytes, base64String;
    if (!str) {
      throw "String is empty";
    }
    srcBytes = me.convertStringToByteArray(str);
    base64Bytes = Packages.org.apache.commons.codec.binary.Base64.encodeBase64(srcBytes);
    base64String = me.convertByteArrayToString(base64Bytes);
    return base64String;
  },

  /**
   * @private
   * Converts a string to a byte array
   * @param {String} str String
   * @return {Byte[]}
   */
  convertStringToByteArray: function (str) {
    var bytes;
    if (!str) {
      throw "String is empty";
    }
    bytes = java.lang.String(str).getBytes("UTF-8");
    return bytes;
  },

  /**
   * @private
   * Converts a byte array to a string
   * @param {Byte[]} bytes
   * @return {String}
   */
  convertByteArrayToString: function (bytes) {
    var javaString, str;
    if (!bytes) {
      throw "Bytes are empty";
    }
    javaString = new java.lang.String(bytes, "UTF-8");
    str = String(javaString);
    return str;
  }
});

