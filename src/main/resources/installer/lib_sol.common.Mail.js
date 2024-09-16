importPackage(Packages.de.elo.ix.client);

//@include lib_Class.js

/**
 * Represents an email.
 *
 * This class allows sending E-Mails by using templates that are stored in the ELO repository.
 *
 * @author ELO Digital Office GmbH
 *
 * @eloas
 * @eloix
 *
 * @requires sol.common.Config
 * @requires sol.common.Template
 * @requires sol.common.ObjectUtils
 * @requires sol.common.RepoUtils
 * @requires sol.common.SordUtils
 * @requires sol.common.WfUtils
 * @requires sol.common.UserUtils
 * @requires sol.common.ExecUtils
 * @requires sol.common.ObjectFormatter
 *
 * The SMTP configuration is read from
 *   /Administration/Business Solutions Custom/common/Configuration/mail.config
 *
 * # SMTP sample configuration:
 *     {
 *        "smtpHost": "smtp.elo.local"
 *     }
 *
 * # Examples of the property 'to':
 *
 *   - "to": "user@domain.com"
 *     Send the email to the email adress "user@domain.com"
 *
 *   - "to": { type: "GRP", key: "CONTRACT_RESPONSIBLE" }
 *     Take the user or email adress from the index field "CONTRACT_RESPONSIBLE"
 *
 *   - "to": { type: "MAP", key: "USER" }
 *     Take the user or email adress from the map field "USER"
 *
 *   - "to": { type: "WFMAP", key: "USER" }
 *     Take the user or email adress from the workflow map field "USER"
 *
 *   - "to": { type: "CURRENT" }
 *     Send the email to the current node user
 *
 *   - "to": { type: "NEXT", key: "USER" }
 *     Send the email to the user of the next person node
 *
 *   - "to": { type: "WFOWNER" }
 *     Send the email to the workflow owner
 *
 *   - "to": { type: "SORDOWNER" }
 *     Send the email to the object owner
 *
 * If a field contains a "@" char, it's interpreted as an email address, otherwise it is
 * interpreted as an ELO user and the email adress will be retrieved from the user
 * profile.
 *
 */
sol.define("sol.common.Mail", {

  /**
   * @cfg {String} smtpHost
   * SMTP host
   */

  /**
   * @cfg {String} from
   * Sender
   */

  /**
   * @cfg {String} to
   * Recipients
   */

  /**
   * @cfg {String} cc
   * Carbon copy recipients
   */

  /**
   * @cfg {String} bcc
   * Blind carbon copy recipients
   */

  /**
   * @cfg {String} subject
   * Subject
   * Templating can be used, e.g. {{sord.name}}
   */

  /**
   * @cfg {Object} body
   * Body configuration
   *
   * @cfg {Object} body.type
   * Body type "html" or "text". Default is "text"
   *
   * @cfg {Object} body.tplObjId
   * Object ID of the body template
   */

  /**
   * @cfg {Object} data
   * This Object will be provided for the template processing.
   */

  /**
   * @cfg {String} objId
   * The data of this sord object will be provided for the template processing.
   */

  /**
   * @cfg {String} flowId
   * The data of this workflow will be provided for the template processing.
   */

  /**
   * @cfg {String} nodeId
   * The data of this workflow node will be provided for the template processing.
   */

  /**
   * @cfg {String} user
   * SMTP user
   */

  /**
   * @cfg {String} password
   * SMTP password
   */

  /**
   * @cfg {Boolean} useSsl
   * Use SSL
   */

  /**
   * @cfg {Boolean} useStartTls
   * Use STARTTLS
   */

  /**
   * @cfg {Boolean} trustAllHosts
   * Trust all hosts
   */

  /**
   * @cfg {Boolean} passwordEncrypted
   * password is encrypted
   */

  /**
   * @cfg {Boolean} debug
   * True if the SMTP debug information should be written into the log
   */

  /**
   * @cfg {Array} atts
   * Attachments
   *
   * # Example:
   *     "atts": [{"objId": "4309"},
   *              {"objId": "4309", "convertToPdf": true},
   *              {"objId": "4309", "convertToEcd": true}]
   *
   *  The convertToPDF is only working in the AS
   */

  /**
   * @cfg {Boolean} noWorkflowInfo
   * If true, the workflow information will not be loaded
   */

  /**
   * @cfg {Number} smtpTimeout
   * SMTP timeout
   */

  /**
   * @cfg {Number} smtpConnectionTimeout
   * SMTP connection timeout
   */

  /**
   * @cfg {Number} smtpWriteTimeout
   * SMTP write timeout
   */

  /**
   * @cfg {String} [sslProtocols=TLSv1.2]
   * Allowed SSL protocols
   */

  /**
   * @private
   * @param {Object} config Configuration
   */
  initialize: function (config) {
    var me = this;
    me.$super("sol.Base", "initialize", [config]);
    me.logger.debug("config={{object}}", config);

    if (sol.common.ExecUtils.classExists("jakarta.mail.Session")) {
      me.isJakarta = true;
      me.mailLib = Packages.jakarta.mail;
      me.activationLib = Packages.jakarta.activation;
      me.socketFactory = Packages.jakarta.net.ssl.SSLContext.default.SSLSocketFactory;
    } else {
      me.isJakarta = false;
      me.mailLib = javax.mail;
      me.activationLib = javax.activation;
      me.socketFactory = new Packages.com.sun.mail.util.MailSSLSocketFactory();
    }
  },

  /**
   * @private
   * Transfers the properties of the given configs into the current context
   * @param {Array} configs Configuations
   */
  transferConfigs: function () {
    var me = this,
        config, prop, i;
    for (i = 0; i < arguments.length; i++) {
      config = arguments[i];
      for (prop in config) {
        me[prop] = config[prop];
      }
    }
  },
  /**
   * @private
   * Initiates a SMTP session
   */
  initSession: function () {
    var me = this,
        socketFactory, props = new java.util.Properties(),
        authenticator = null,
        mailConfig;

    if (!me.smtpHost) {
      if (me.solutionNameForAsConfig) {
        mailConfig = me.loadMailConfig("/Administration/Business Solutions/" + me.solutionNameForAsConfig + "/Configuration/mail.config");
      }
      if (!mailConfig) {
        mailConfig = me.loadMailConfig("/Administration/Business Solutions/common/Configuration/mail.config");
      }
    }

    mailConfig = mailConfig || {};

    me.smtpHost = me.smtpHost || mailConfig.smtpHost;
    me.port = me.port || mailConfig.port;
    me.user = me.user || mailConfig.user;
    me.password = me.password || mailConfig.password;
    me.useSsl = (typeof me.useSsl != "undefined") ? me.useSsl : mailConfig.useSsl;
    me.useStartTls = (typeof me.useStartTls != "undefined") ? me.useStartTls : mailConfig.useStartTls;

    me.smtpTimeout = (me.smtpTimeout || mailConfig.smtpTimeout || 30000) + "";
    me.smtpConnectionTimeout = (me.smtpConnectionTimeout || mailConfig.smtpConnectionTimeout || 30000) + "";
    me.smtpWriteTimeout = (me.smtpWriteTimeout || mailConfig.smtpWriteTimeout || 30000) + "";

    me.trustAllHosts = (typeof me.trustAllHosts != "undefined") ? me.trustAllHosts : mailConfig.trustAllHosts;
    me.trustAllHosts = (typeof me.trustAllHosts != "undefined") ? me.trustAllHosts : true;

    me.passwordEncrypted = (typeof me.passwordEncrypted != "undefined") ? me.passwordEncrypted : mailConfig.passwordEncrypted;

    if (!me.smtpHost) {
      throw "SMTP host must be set.";
    }
    props.put("mail.smtp.host", me.smtpHost);
    props.put("mail.smtp.localhost", java.net.InetAddress.localHost.hostName);
    if (me.password) {
      props.put("mail.smtp.auth", "true");
      authenticator = new me.mailLib.Authenticator(me);
    }
    if (me.useSsl || me.useStartTls) {
      if (me.useSsl) {
        me.port = me.port || "465";
        props.put("mail.smtp.ssl.enable", "true");
      } else {
        me.port = me.port || "587";
        props.put("mail.smtp.starttls.enable", "true");
      }
      if (me.trustAllHosts) {
        if (me.isJakarta) {
          me.socketFactory.hostnameVerifier = Packages.jakarta.net.ssl.SSLSocketFactory.ALLOW_ALL_HOSTNAME_VERIFIER;
        } else {
          me.socketFactory.trustAllHosts = true;
        }

        props.put("mail.smtp.ssl.socketFactory", me.socketFactory);
      }
      me.sslProtocols = mailConfig.sslProtocols || "TLSv1.2";
    } else {
      me.port = me.port || "25";
    }

    props.put("mail.smtp.port", me.port);

    props.put("mail.smtp.timeout", me.smtpTimeout);
    props.put("mail.smtp.connectiontimeout", me.smtpConnectionTimeout);
    props.put("mail.smtp.writetimeout", me.smtpWriteTimeout);

    me.logger.debug("Start SMTP session: " + props);
    me.session = me.mailLib.Session.getInstance(props, authenticator);

    if (me.logger.debugEnabled) {
      me.logger.debug(["JavaMail/JakartaMail: version={0}, isJakarta=", me.session.getClass().package.implementationVersion, me.isJakarta]);
      me.logger.debug(["Mail session class name: {0}", me.session.getClass().name]);
      me.logger.debug(["Supported SSL protocols: {0}", java.lang.String.join(" ", javax.net.ssl.SSLContext.default.supportedSSLParameters.protocols)]);

      sol.common.ExecUtils.logJarFilePath("javax.mail.Session");
      sol.common.ExecUtils.logJarFilePath("javax.mail.util.ByteArrayDataSource");
      sol.common.ExecUtils.logJarFilePath("javax.activation.DataHandler");

      sol.common.ExecUtils.logJarFilePath("jakarta.mail.Session");
      sol.common.ExecUtils.logJarFilePath("jakarta.mail.util.ByteArrayDataSource");
      sol.common.ExecUtils.logJarFilePath("jakarta.activation.DataHandler");
    }

    if ((me.useSsl || me.useStartTls) && me.sslProtocols) {
      me.logger.debug(["Allowed SMTP SSL protocols: {0}", me.sslProtocols]);
      props.setProperty("mail.smtp.ssl.protocols", me.sslProtocols);
    }

    if (me.debug) {
      me.session.debug = true;
      me.outputStream = new java.io.ByteArrayOutputStream();
      me.session.setDebugOut(new java.io.PrintStream(me.outputStream));
    }
  },

  /**
   * Loads the mail configuration
   * @param {String} repoPath
   * @return {Object} Mail configuration
   */
  loadMailConfig: function (repoPath) {
    var conn, objId, config;

    conn = (typeof ixConnectAdmin !== "undefined") ? ixConnectAdmin : ixConnect;

    objId = sol.common.RepoUtils.getObjId(repoPath);

    if (!objId) {
      return;
    }

    config = sol.create("sol.common.Config", { compose: objId, connection: conn }).config;

    return config;
  },

  /**
   * @private
   * Retrieves the data that is provided for templating
   */
  getData: function () {
    var me = this,
        wfDiagram;

    me.body = me.body || {};
    me.data = me.data || me.body.data || {};

    if (me.objId) {
      me.sord = ixConnect.ix().checkoutSord(me.objId, EditInfoC.mbSord, LockC.NO).sord;
      me.data.sord = sol.common.SordUtils.getTemplateSord(me.sord).sord;
    }

    if (me.flowId && me.nodeId && !me.noWorkflowInfo) {
      wfDiagram = me.getWorkflow();
      me.data.node = sol.common.WfUtils.getTemplateWfDiagramNode(wfDiagram, String(me.nodeId)).node;
    }
  },


  getValue: function (def) {
    var me = this,
        value, wfDiagram, wfNode, successorNodes;

    if (!def) {
      return "";
    }

    if (sol.common.ObjectUtils.isObject(def)) {
      if (!def.type) {
        throw "to.type is empty";
      }

      me.logger.debug("valueConfig=" + JSON.stringify(def));

      switch (String(def.type).toUpperCase()) {

        case "GRP":
          me.checkKey(def);
          value = sol.common.SordUtils.getValue(me.sord, def);
          break;

        case "MAP":
          me.checkKey(def);
          value = sol.common.SordUtils.getValue(me.sord, def);
          break;

        case "SORDOWNER":
          value = me.sord.ownerName;
          break;

        case "WFMAP":
          me.checkKey(def);
          me.checkWorkflowProps();
          value = sol.common.WfUtils.getWfMapValue(me.flowId, def.key);
          break;

        case "CURRENT":
          wfDiagram = me.getWorkflow();
          wfNode = sol.common.WfUtils.getNode(wfDiagram, me.nodeId);
          if (wfNode) {
            value = wfNode.userName;
          } else {
            me.logger.warn(["Can't determinate workflow node: flowId={0}, nodeId={1}", wfDiagram.id, me.nodeId]);
          }
          break;

        case "NEXT":
          wfDiagram = me.getWorkflow();
          successorNodes = sol.common.WfUtils.getSuccessorNodes(wfDiagram, me.nodeId, WFNodeC.TYPE_PERSONNODE);
          if (!successorNodes || (successorNodes.length == 0)) {
            throw "No appropriate successor node found";
          }
          if (successorNodes.length > 1) {
            throw "Successor node is ambiguous";
          }
          value = successorNodes[0].userName;
          break;

        case "WFOWNER":
          wfDiagram = me.getWorkflow();
          value = wfDiagram.ownerName;
          break;

        default:
          throw "def.type=" + def.type + " is unsupported";
      }
    } else {
      value = def;
    }

    return value;
  },

  /**
   * @private
   * Retrieves the recipient of the mail
   * @param {Object|String} to Recipient definition
   * @return {String} recipient
   */
  getRecipient: function (to) {
    var me = this, recipient;
    recipient = me.getValue(to);
    if (!recipient) {
      throw "Recipient user is empty";
    }

    if (recipient.indexOf("@") == -1) {
      recipient = String(sol.common.UserUtils.getMailAddress(recipient));

      if (recipient.indexOf("@") == -1) {
        throw "Recipient is not a mail adress";
      }

    }
    if (!recipient) {
      throw "Recipient is empty";
    }

    return recipient;
  },

  /**
   * @private
   * Retrieves the sender of the mail
   * @param {Object|String} from Sender definition
   * @return {String} sender
   */
  getSender: function (from) {
    var me = this, sender;
    sender = me.getValue(from);
    if (!sender) {
      throw "Sender user is empty";
    }

    if (sender.indexOf("@") == -1) {
      sender = String(sol.common.UserUtils.getMailAddress(sender));

      if (sender.indexOf("@") == -1) {
        throw "Sender is not a mail adress";
      }

    }

    if (!sender) {
      throw "Sender is empty";
    }

    return sender;
  },

  /**
   * @private
   * Retrieves the subject of the mail
   * @param {Object|String} subj subject definition
   * @return {String} subject
   */
  getSubject: function (subj) {
    var me = this,
        subject, tpl;

    if (!(subject = me.getValue(subj))) {
      throw "subject is empty";
    }

    if (subject.indexOf("{{") > -1) {
      tpl = sol.create("sol.common.Template", { source: subject });
      subject = tpl.apply(me.data);
    }

    return subject;
  },

  /**
   * @private
   * @param {Object} to Recipient configuration
   * Checks the key value
   */
  checkKey: function (to) {
    if (!to.key) {
      throw "to.key is empty";
    }
  },

  /**
   * @private
   * Checks the me.flowId property
   */
  checkWorkflowProps: function () {
    var me = this;
    if (!me.flowId) {
      throw "flowId is empty";
    }
  },

  /**
   * @private
   * Returns the workflow diagram
   * @return {de.elo.ix.client.WFDiagram}
   */
  getWorkflow: function () {
    var me = this;

    if (!me.wfDiagram) {
      if (!me.flowId) {
        throw "flowId is empty";
      }
      if (!me.nodeId) {
        throw "nodeId is empty";
      }

      me.wfDiagram = ixConnect.ix().checkoutWorkFlow(me.flowId, WFTypeC.ACTIVE, WFDiagramC.mbAll, LockC.NO);
    }

    return me.wfDiagram;
  },

  /**
   * @private
   * @return {javax.mail.PasswordAuthentication|jakarta.mail.PasswordAuthentication} Authententication
   */
  getPasswordAuthentication: function () {
    var me = this,
        des, password;

    if (me.passwordEncrypted) {
      des = new Packages.de.elo.utils.sec.DesEncryption();
      password = des.decrypt(me.password);
    } else {
      password = me.password;
    }
    return new me.mailLib.PasswordAuthentication(me.user, password);
  },

  /**
   * Sends an email
   */
  send: function () {
    var me = this,
        message, multiPart,
        i, attConfig, sord, attInputStream, dataSource, attPart, subject, fileName, sanitizedSordName, contentType;

    if (!me.from) {
      throw "'From' is empty.";
    }
    me.initSession();
    me.getData();
    me.recipient = me.getRecipient(me.to);
    if (!me.recipient) {
      throw "Recipient is empty.";
    }

    me.cc = me.cc || "";
    me.cc && (me.recipientCc = me.getRecipient(me.cc));

    me.bcc = me.bcc || "";
    me.bcc && (me.recipientBcc = me.getRecipient(me.bcc));

    message = new me.mailLib.internet.MimeMessage(me.session);
    message.setFrom(new me.mailLib.internet.InternetAddress(me.getSender(me.from)));

    me.recipient.split(";").forEach(function (toPart) {
      message.addRecipient(me.mailLib.Message.RecipientType.TO, new me.mailLib.internet.InternetAddress(toPart));
    });
    me.recipientCc && me.recipientCc.split(";").forEach(function (ccPart) {
      message.addRecipient(me.mailLib.Message.RecipientType.CC, new me.mailLib.internet.InternetAddress(ccPart));
    });
    me.recipientBcc && me.recipientBcc.split(";").forEach(function (bccPart) {
      message.addRecipient(me.mailLib.Message.RecipientType.BCC, new me.mailLib.internet.InternetAddress(bccPart));
    });

    subject = me.getSubject(me.subject) || "";
    message.setSubject(subject, "UTF-8");
    multiPart = new me.mailLib.internet.MimeMultipart();
    me.addBody(multiPart);
    if (me.atts) {
      for (i = 0; i < me.atts.length; i++) {
        attConfig = me.atts[i];
        if (attConfig.objId == "CURRENT") {
          if (me.sord && sol.common.SordUtils.isDocument(me.sord)) {
            attConfig.objId = me.sord.id;
          } else {
            if (attConfig.convertToEcd && me.sord) {
              attConfig.objId = me.sord.id;
            } else {
              continue;
            }
          }
        }
        me.logger.debug(["Add attachment: objId={0}", attConfig.objId]);
        sord = ixConnect.ix().checkoutSord(attConfig.objId, EditInfoC.mbSordDoc, LockC.NO).sord;
        if (attConfig.convertToEcd) {
          attConfig.extension = "ECD";
        } else {
          attConfig.extension = sord.docVersion.ext;
        }

        sanitizedSordName = sol.common.FileUtils.sanitizeFilename(sord.name);

        contentType = java.net.URLConnection.guessContentTypeFromName("content." + attConfig.extension) || "application/octet-stream";
        me.logger.debug("extension=" + attConfig.extension + ", contentType=" + contentType);
        
        fileName = sanitizedSordName + "." + attConfig.extension;

        attInputStream = me.getAttAsStream(attConfig);

        dataSource = new me.mailLib.util.ByteArrayDataSource(attInputStream, contentType);
        attInputStream.close();
        attPart = new me.mailLib.internet.MimeBodyPart();
        attPart.dataHandler = new me.activationLib.DataHandler(dataSource);

        attPart.fileName = fileName;

        multiPart.addBodyPart(attPart);
      }
    }
    message.setContent(multiPart);
    me.logger.info(["Send mail: recipient={0}, subject={1}", me.recipient, me.subject]);
    me.mailLib.Transport.send(message);

    me.logJavaMailInfo();
  },

  /**
   * @private
   * @param {javax.mail.Multipart} multiPart MultiPart
   */
  addBody: function (multiPart) {
    var me = this,
        bodyContent, template, bodyPart;

    me.body = me.body || {};
    bodyContent = me.body.content || "";

    if (me.body.tplObjId) {
      template = sol.create("sol.common.Template", {});
      template.load(me.body.tplObjId);
      bodyContent = template.apply(me.data);
    }
    bodyPart = new me.mailLib.internet.MimeBodyPart();
    if (me.body.type == "html") {
      bodyPart.setContent(bodyContent, "text/html; charset=utf-8");
    } else {
      bodyPart.setContent(bodyContent, "text/plain");
    }
    multiPart.addBodyPart(bodyPart);
  },

  /**
   * @private
   */
  logJavaMailInfo: function () {
    var me = this;
    if (me.debug) {
      me.logger.info(me.outputStream);
    }
  },

  /**
   * @private
   * @param {object} attConfig Attachment configuration
   * @return {java.io.InputStream} Attachment input stream
   */
  getAttAsStream: function (attConfig) {
    var officeConverter, inputStream;
    if (attConfig.objId) {
      if (attConfig.convertToPdf) {
        officeConverter = sol.create("sol.common.as.functions.OfficeConverter", {
          openFromRepo: {
            objId: attConfig.objId
          },
          saveToStream: {
            format: "pdf"
          }
        });
        if (officeConverter.isSupported(attConfig.extension)) {
          inputStream = officeConverter.execute();
          attConfig.extension = "pdf";
          return inputStream;
        }
      }

      if (attConfig.convertToEcd) {
        return sol.common.FileUtils.getEcdAsStream(attConfig.objId);
      }
    }
    return sol.common.RepoUtils.downloadToStream(attConfig.objId);
  }
});