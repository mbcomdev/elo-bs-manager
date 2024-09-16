
//@include lib_Class.js

/**
 * Contains workflow related utility functions
 *
 * @author ELO Digital Office GmbH
 *
 * @eloix
 * @eloas
 * @elojc
 * @requires sol.common.Config
 * @requires sol.common.ConfigMixin
 * @requires sol.common.ObjectUtils
 * @requires sol.common.StringUtils
 * @requires sol.common.SordUtils
 * @requires sol.common.UserUtils
 * @requires sol.common.UserProfile
 * @requires sol.common.DateUtils
 *
 */
sol.define("sol.common.WfUtils", {
  singleton: true,

  /**
   * @private
   */
  logger: sol.create("sol.Logger", { scope: "sol.common.WfUtils" }),

  /**
   * @private
   * Loads the base configuration from the JSON file: `/Administration/Business Solutions/common/Configuration/base.config`
   * @return {Object}
   */
  loadBaseConfig: function () {
    var me = this;
    if (!me.baseConfig) {
      me.baseConfig = sol.create("sol.common.Config", { load: "ARCPATH[(E10E1000-E100-E100-E100-E10E10E10E00)]:/Business Solutions/common/Configuration/base.config" }).config;
    }
    return me.baseConfig;
  },

  /**
   * Starts a workflow.
   * @param {String} templFlowId Name or ID of the template which should be started
   * @param {String} flowName Name of the new workflow
   * @param {String} objId Object on which the workflow should be started
   * @param {Number} prio (optional) If specified, the workflow priority will be changed (0=high, 1=medium, 2=low)
   * @return {Number} The ID of the started workflow
   */
  startWorkflow: function (templFlowId, flowName, objId, prio) {
    var me = this,
        flowId;

    me.logger.enter("startWorkflow", arguments);

    if (!templFlowId) {
      throw "Workflow template ID is empty";
    }

    if (flowName && flowName.length > 120) {
      flowName = flowName.substr(0, 120);
    }

    flowId = ixConnect.ix().startWorkFlow(templFlowId, flowName, objId);
    if (typeof prio !== "undefined") {
      me.changeWorkflowPriority(flowId, prio);
    }

    me.logger.exit("startWorkflow", { flowId: flowId });

    return flowId;
  },

  /**
   * Starts the workflow defined as standard workflow for the mask or in an index field.
   * If there is already an workflow, it will do nothing and return the first active one.
   * @param {String} objId
   * @param {Object} params (optional) Default will be the sord name
   * @param {Object} params.name (optional) Default will be the sord name
   * @param {Object} params.field (optional) The field to read the workflow template from
   * @return {String} The workflow ID
   */
  startMaskStandardWorkflow: function (objId, params) {
    var me = this,
        activeWorkflows, sord, templateName, templateId, maskName, docMask, name, flowId;

    me.logger.enter("startMaskStandardWorkflow", arguments);

    activeWorkflows = sol.common.WfUtils.getActiveWorkflows(objId);

    if (activeWorkflows.length > 0) {
      return activeWorkflows[0].id;
    }

    sord = ixConnect.ix().checkoutSord(objId, SordC.mbAllIndex, LockC.NO);
    if (params && params.field) {
      templateName = sol.common.SordUtils.getObjKeyValue(sord, params.field);
      if (templateName) {
        templateId = sol.common.WfUtils.getWorkflowTemplateId(templateName);
      }
    }

    if (!templateId) {
      maskName = sord.maskName;
      docMask = sol.common.SordUtils.getDocMask(maskName);
      templateId = docMask.flowId;
    }

    if (!templateId || templateId === -1) {
      throw "mask '" + maskName + "' does not define a standard workflow";
    }

    name = (params && params.name) ? params.name : sord.name;
    if (name && name.length > 120) {
      name = name.substr(0, 120);
    }

    flowId = me.startWorkflow(templateId, name, objId);

    me.logger.exit("startMaskStandardWorkflow", { flowId: flowId });

    return flowId;
  },

  /**
   * Returns a specific workflow.
   * @param {String} flowId Flow ID
   * @param {Object} params (optional)
   * @param {Boolean} params.inclFinished (optional) If `true`, the workflows will be returned, even if it is already finished
   * @return {de.elo.ix.client.WFDiagram}
   */
  getWorkflow: function (flowId, params) {
    var workflow;
    try {
      workflow = ixConnect.ix().checkoutWorkFlow(flowId, WFTypeC.ACTIVE, WFDiagramC.mbAll, LockC.NO);
    } catch (ex) {
      if (params && (params.inclFinished === true)) {
        workflow = ixConnect.ix().checkoutWorkFlow(flowId, WFTypeC.FINISHED, WFDiagramC.mbAll, LockC.NO);
      } else {
        throw ex;
      }
    }
    return workflow;
  },

  wfDiagramTypeId: 1663767661,
  wfVersionTypeId: 914434915,
  wfNodeTypeId: 2015686193,
  wfEscalationTypeId: 633363356,
  wfEscalationUserTypeId: 123879203,

  /**
   * Returns workflow diagram as JSON string
   * @param {String} flowId Workflow ID
   * @param {String} config Configuration
   * @param {Boolean} [config.clearUsers=false] Clear the owner names of the template
   * @param {Boolean} [config.addSubTemplateInfo=false] Add sub template information
   * @return {String} JSON representation of the workflow diagram
   */
  getWorkflowAsJson: function (flowId, config) {
    var me = this,
        fileData, workflowExportOptions, workflowTplJson, workflowTplObj;

    flowId += "";

    config = config || {};

    if (!flowId) {
      throw new Error("Flow ID is missing.");
    }

    if (config.addSubTemplateInfo) {
      me.addSubTemplateInfo(flowId);
    }

    workflowExportOptions = new WorkflowExportOptions();
    workflowExportOptions.flowId = flowId;

    workflowExportOptions.format = WorkflowExportOptionsC.FORMAT_JSON;
    workflowExportOptions.flowVersId = "0";

    fileData = ixConnect.ix().exportWorkflow(workflowExportOptions);
    workflowTplJson = String(new java.lang.String(fileData.data, "UTF-8"));

    workflowTplObj = JSON.parse(workflowTplJson);

    sol.common.ObjectUtils.traverse(workflowTplObj, function (key, obj) {
      if (config.clearUsers && (obj._typeId == me.wfVersionTypeId)) {
        obj.userId = 0;
        obj.userName = "";
      }
    });

    workflowTplJson = JSON.stringify(workflowTplObj);

    return workflowTplJson;
  },

  /**
   * Adds sub template info
   * @param {Integer} flowId Flow ID
   */
  addSubTemplateInfo: function (flowId) {
    var me = this,
        propertiesObj = {},
        wfDiag, i, node;

    flowId += "";

    if (!flowId) {
      return;
    }

    wfDiag = ixConnect.ix().checkoutWorkflowTemplate(flowId, "", WFDiagramC.mbAll, LockC.NO);

    for (i = 0; i < wfDiag.nodes.length; i++) {
      node = wfDiag.nodes[i];

      if (node.type != WFNodeC.TYPE_CALL_SUB_WORKFLOW) {
        continue;
      }

      try {
        propertiesObj = JSON.parse(node.properties);
      } catch (ignore) {
        // ignore
      }
      propertiesObj.subTemplateName = me.getWorkflowTemplateName(node.subTemplateId);

      node.properties = JSON.stringify(propertiesObj, "", 2);

      me.addSubTemplateInfo(node.subTemplateId); // sub template info should also be set recursively
    }

    ixConnect.ix().checkinWorkflowTemplate(wfDiag, WFDiagramC.mbAll, LockC.NO);
  },

  /**
   * Returns the workflow name
   * @param {String} workflowJson Workflow JSON
   * @return {String} Workflow name
   */
  getWfNameFromJson: function (workflowJson) {
    var me = this,
        workflowObj, objectTable, i, obj, typeId;

    if (!workflowJson) {
      throw "Workflow JSON content is empty";
    }
    workflowObj = JSON.parse(workflowJson);
    objectTable = workflowObj.objectTable;
    for (i = 0; i < objectTable.length; i++) {
      obj = objectTable[i];
      if (obj) {
        typeId = obj["_typeId"];
        if (typeId && (typeId == me.wfDiagramTypeId)) {
          return obj.name;
        }
      }
    }
  },

  /**
   * Returns the workflow names
   * @param {String} workflowJson Workflow JSON
   * @return {Array} Workflow names
   */
  getAllWorkflowNamesFromJson: function (workflowJson) {
    var me = this,
        workflowNames = [], workflowTplObj;

    if (!workflowJson) {
      throw "Workflow JSON content is empty";
    }

    workflowTplObj = JSON.parse(workflowJson);

    sol.common.ObjectUtils.traverse(workflowTplObj, function (key, obj) {
      if (obj._typeId == me.wfDiagramTypeId) {
        workflowNames.push(obj.name);
      }
    });

    return workflowNames;
  },

  /**
   * Retrieves the active workflows for an object.
   * @param {String} objId
   * @param {Object} filter (optional)
   * @param {String} filter.template (optional) Filter results by name or ID of the workflow template
   * @param {Boolean} filter.user (optional) If `true` the active workflows will be filtered by the current user
   * @return {de.elo.ix.client.WFDiagram[]}
   */
  getActiveWorkflows: function (objId, filter) {
    var findInfo = new FindWorkflowInfo();

    findInfo.objId = objId;
    findInfo.type = WFTypeC.ACTIVE;

    if (filter && filter.template) {
      findInfo.templateId = filter.template;
    }

    return this.findWorkflows(findInfo, null, ((filter && filter.user === true) || (typeof ixConnectAdmin === "undefined")) ? ixConnect : ixConnectAdmin);
  },

  /**
   * Checks, if an object has at least on active workflow.
   * If a template name is defined, the function checks, if there is at least one active workflow with this template.
   * @param {String} objId
   * @param {String} template (optional)
   * @return {Boolean}
   */
  hasActiveWorkflow: function (objId, template) {
    var filter;
    if (template) {
      filter = { template: template };
    }
    return (this.getActiveWorkflows(objId, filter).length > 0);
  },


  /**
   * Returns the last active workflow for an object
   * @param {String} objId Object ID
   * @return {de.elo.ix.client.WFDiagram}
   */
  getLastActiveWorkflow: function (objId) {
    var me = this,
        workflows;
    if (!objId) {
      throw "Object ID is empty";
    }
    workflows = me.getActiveWorkflows(objId);
    if (workflows && (workflows.length > 0)) {
      return workflows[workflows.length - 1];
    }
  },

  /**
   * Retrieves workflows with a search request.
   * @param {de.elo.ix.client.FindWorkflowInfo} findWorkflowInfo Defines the search
   * @param {de.elo.ix.client.WFDiagramC} [checkoutOptions=WFDiagramC.mbLean] (optional) Defines the members which will be returned in the result
   * @param {de.elo.ix.client.IXConnection} [ixConn=ixConnect] (optional)
   * @return {de.elo.ix.client.WFDiagram[]}
   */
  findWorkflows: function (findWorkflowInfo, checkoutOptions, ixConn) {
    var me = this,
        max = 100,
        idx = 0,
        workflows = [],
        findResult, i, wf;

    ixConn = ixConn || ixConnect;
    checkoutOptions = checkoutOptions || WFDiagramC.mbLean;

    try {
      findResult = ixConn.ix().findFirstWorkflows(findWorkflowInfo, max, checkoutOptions);
      while (true) {
        for (i = 0; i < findResult.workflows.length; i++) {
          wf = findResult.workflows[i];
          workflows.push(wf);
        }

        if (!findResult.moreResults) {
          break;
        }
        idx += findResult.workflows.length;
        findResult = ixConn.ix().findNextWorkflows(findResult.searchId, idx, max);
      }
    } catch (ex) {
      me.logger.warn("error looking up workflows", ex);
    } finally {
      if (findResult) {
        ixConn.ix().findClose(findResult.searchId);
      }
    }
    return workflows;
  },

  /**
   * Changes the priority of a workflow.
   * @param {String} flowId The workflows ID
   * @param {Number} prio The new priority (0=high, 1=medium, 2=low)
   */
  changeWorkflowPriority: function (flowId, prio) {
    var wfDiagram;
    if ((typeof prio !== "undefined") && (Object.prototype.toString.call(prio) === "[object Number]") && (prio >= 0) && (prio <= 2)) {
      wfDiagram = ixConnect.ix().checkoutWorkFlow(flowId, WFTypeC.ACTIVE, WFDiagramC.mbAll, LockC.NO);
      if (wfDiagram.prio !== prio) {
        wfDiagram.prio = prio;
        ixConnect.ix().checkinWorkFlow(wfDiagram, WFDiagramC.mbAll, LockC.NO);
      }
    }
  },

  /**
   * Cancels a workflow.
   * @param {String} flowId
   * @param {Boolean} force (optional) If `true`, the workflow will be terminated ignoring existing locks
   * @param {Object} params (optional) Parameters
   * @param {de.elo.ix.client.IXConnection} [params.connection=ixConnect] (optional) Index Server connection
   * @return {Number} The canceled workflow ID
   */
  cancelWorkflow: function (flowId, force, params) {
    var conn, canceledFlowId;

    params = params || {};
    conn = params.connection || ixConnect;

    canceledFlowId = conn.ix().terminateWorkFlow(flowId, (force) ? LockC.FORCE : LockC.YES);

    return canceledFlowId;
  },

  /**
   * Returns the Status of the workflow.
   * @param {String|de.elo.ix.client.WFDiagram} flow Either a flowId or WFDiagram (to avoid loading it again)
   * @return {String}
   */
  getWorkflowStatus: function (flow) {
    var me = this,
        startNode;

    if (!flow) {
      throw "Flow is empty";
    }

    if (!flow.id) {
      flow = me.getWorkflow(flow);
    }
    startNode = me.getNode(flow, 0);

    return (startNode) ? String(startNode.yesNoCondition) : "";
  },

  /**
   * Sets the workflow status.
   * @param {de.elo.ix.client.WFDiagram} wfDiagram Workflow diagram
   * @param {String} status Workflow status
   */
  setWorkflowStatus: function (wfDiagram, status) {
    var me = this,
        startNode;
    if (!wfDiagram) {
      throw "Workflow diagram is empty";
    }
    status = status || "";
    startNode = me.getNode(wfDiagram, 0);
    startNode.yesNoCondition = status;
  },

  /**
   * Retrieves the available workflow templates.
   * @param {Object} params Parameters
   * @param {de.elo.ix.client.WFDiagramC} [params.wfDiagramZ=WFDiagramC.mbLean] (optional) Defines the members which will be returned in the result
   * @return {de.elo.ix.client.WFDiagram[]}
   */
  getTemplates: function (params) {
    var me = this, ixConn, result, originalProperty,
        info;
    params = params || {};
    info = new FindWorkflowInfo();
    info.type = WFTypeC.TEMPLATE;

    //  we need to change the connection to avoid translated workflow templates
    ixConn = (typeof ixConnectAdmin === "undefined") ? ixConnect : ixConnectAdmin;
    originalProperty = ixConn.getSessionOptions().getProperty(SessionOptionsC.TRANSLATE_TERMS);
    ixConn.getSessionOptions().setProperty(SessionOptionsC.TRANSLATE_TERMS, "false");
    ixConn.getSessionOptions().update();

    result = me.findWorkflows(info, params.wfDiagramZ, ixConn);

    // and now we'll change the option back to avoid untranslated terms in all the other requests
    ixConn.getSessionOptions().setProperty(SessionOptionsC.TRANSLATE_TERMS, String(originalProperty));
    ixConn.getSessionOptions().update();

    return result;
  },

  /**
   * Returns the template ID of a workflow
   * @param {String} workflowTemplateName Name of the workflow template
   * @return {String} Workflow ID
   */
  getWorkflowTemplateId: function (workflowTemplateName) {
    var wfDiag = ixConnect.ix().checkoutWorkflowTemplate(workflowTemplateName, "", new WFDiagramZ(WFDiagramC.mbId), LockC.NO);
    return wfDiag.id;
  },

  /**
   * Returns the template name of a workflow
   * @param {String} workflowTemplateId ID of the workflow template
   * @return {String} Workflow name
   */
  getWorkflowTemplateName: function (workflowTemplateId) {
    var wfDiag, wfName;
    if (typeof workflowTemplateId == "undefined") {
      return "";
    }

    workflowTemplateId += "";

    wfDiag = ixConnect.ix().checkoutWorkflowTemplate(workflowTemplateId, "", new WFDiagramZ(WFDiagramC.mbName), LockC.NO);
    if (!wfDiag) {
      return "";
    }
    wfName = wfDiag.name + "";
    return wfName;
  },

  /**
   * Exports a workflow template into a specified file
   * @param {String} workflowTemplateName Name of the workflow template
   * @param {java.io.File} file Export file
   * @param {Object} config Configuration
   * @param {Boolean} clearAdminName Clear the administrator user name
   * @return {Array} Exported workflow template names
   */
  exportWorkflowTemplate: function (workflowTemplateName, file, config) {
    var me = this,
        workflowTemplateId, exportedWorkflowTemplateNames;

    workflowTemplateId = me.getWorkflowTemplateId(workflowTemplateName);
    exportedWorkflowTemplateNames = me.exportWorkflow(workflowTemplateId, file, config);

    return exportedWorkflowTemplateNames;
  },

  /**
   * Exports a workflow into a specified file
   * @param {String} workflowId Workflow ID
   * @param {java.io.File} file Export file
   * @param {Object} config Configuration
   * @param {Boolean} clearAdminName Clear the administrator user name
   * @return {workflowNames} Exported workflow names
   */
  exportWorkflow: function (workflowId, file, config) {
    var me = this,
        workflowJson, exportedWorkflowNames;

    workflowJson = me.getWorkflowAsJson(workflowId, config);
    Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, workflowJson, "UTF-8");

    exportedWorkflowNames = me.getAllWorkflowNamesFromJson(workflowJson);

    return exportedWorkflowNames;
  },

  /**
   * Imports a workflow into a specified file
   * @param {String} workflowName Workflow name
   * @param {java.io.File} file Import file
   * @param {Object} params Parameters
   * @param {Boolean} [params.replaceMissingUserByUserId=0] Replace a missing user by this user ID
   * @return {Object} importResult Import result
   * @return {Array} importResult.replacedSubTemplateIds Replaced sub template IDs
   * @return {Integer} importResult.flowId Workflow ID
   */
  importWorkflow: function (workflowName, file, params) {
    var importResult = {},
        workflowData, workflowImportOptions, workflowTemplateJson;

    if (!workflowName) {
      throw "Workflow name is empty";
    }

    if (!file) {
      throw "Workflow file is empty";
    }

    params = params || {};
    params.replaceMissingUserByUserId = (typeof params.replaceMissingUserByUserId == "undefined") ? "0" : params.replaceMissingUserByUserId;

    workflowImportOptions = new WorkflowImportOptions();
    workflowImportOptions.replaceMissingUserByUserId = params.replaceMissingUserByUserId;

    workflowTemplateJson = Packages.org.apache.commons.io.FileUtils.readFileToString(file, "UTF-8") + "";

    workflowData = (new java.lang.String(workflowTemplateJson)).getBytes("UTF-8");

    importResult.flowId = ixConnect.ix().importWorkFlow2(workflowName, workflowData, workflowImportOptions);
    return importResult;
  },

  /**
   * Renames workflow templates
   * @param {String} oldName Old name
   * @param {String} newName New name
   * @return {Object} Result object
   */
  renameWorkflowTemplate: function (oldName, newName) {
    var me = this,
        wfDiag, result;

    if (!oldName) {
      throw "Old workflow template name is empty";
    }

    if (!newName) {
      throw "New workflow template name is empty";
    }

    try {
      wfDiag = me.getWorkflowTemplate(oldName);
    } catch (ex) {
      return;
    }

    wfDiag.name = newName;
    ixConnect.ix().checkinWorkflowTemplate(wfDiag, WFDiagramC.mbAll, LockC.NO);

    result = {
      wfTplId: wfDiag.id + "",
      oldName: oldName,
      newName: newName
    };

    return result;
  },

  /**
   * Merge workflow template
   * After the workflow templateshave been imported via JSON with a timestamp suffix, they will be stored as a new working
   * version of the origin workflow and than the imported workflow will be deleted.
   * @param {String} workflowTemplateName Workflow template name
   * @return {Object} Result object
   */
  mergeWorkflowTemplate: function (workflowTemplateName) {
    var me = this,
        i, workflowTemplates, workflowTemplate, originWorkflowTemplate, originWorkflowTemplateNamePrefix,
        currentWorkflowTemplateName, updateWorkflowTemplate, updateWorkflowTemplateId, result;

    if (!workflowTemplateName) {
      throw "Workflow template name is empty";
    }
    workflowTemplates = me.getTemplates({ wfDiagramZ: WFDiagramC.mbAll });

    for (i = 0; i < workflowTemplates.length; i++) {
      workflowTemplate = workflowTemplates[i];
      currentWorkflowTemplateName = workflowTemplate.name + "";
      originWorkflowTemplateNamePrefix = workflowTemplateName + " | origin -";

      if (currentWorkflowTemplateName.indexOf(originWorkflowTemplateNamePrefix) == 0) {
        originWorkflowTemplate = workflowTemplate;
        originWorkflowTemplate.name = workflowTemplateName;
      }

      if (currentWorkflowTemplateName == workflowTemplateName) {
        updateWorkflowTemplate = workflowTemplate;
        updateWorkflowTemplateId = updateWorkflowTemplate.id;
      }
    }

    if (!originWorkflowTemplate || !updateWorkflowTemplate) {
      return;
    }

    me.addWorkflowTemplateWorkingVersion(updateWorkflowTemplate, originWorkflowTemplate);
    me.deleteWorkflowTemplate(updateWorkflowTemplateId);

    result = {
      wfTplName: workflowTemplateName,
      wfTplId: originWorkflowTemplate.id + "",
      originWorkflow: {
        name: originWorkflowTemplate.name + "",
        wfTplId: originWorkflowTemplate.id + ""
      },
      updateWorkflow: {
        name: updateWorkflowTemplate.name + "",
        wfTplId: updateWorkflowTemplateId,
        deleted: true
      }
    };

    return result;
  },

  /**
   * @deprecated
   * @param  {de.elo.ix.client.WFDiagram} fromWorkflowTemplate Source workflow template
   * @param  {de.elo.ix.client.WFDiagram} toWorkflowTemplate Destination workflow template
   */
  addWorkflowTemplateVersions: function (fromWorkflowTemplate, toWorkflowTemplate) {
    var me = this;
    me.addWorkflowTemplateWorkingVersion(fromWorkflowTemplate, toWorkflowTemplate);
  },

  /**
   * Add the working version of a workflow template as working version of another workflow template
   * @param  {de.elo.ix.client.WFDiagram} fromWorkflowTemplate Source workflow template
   * @param  {de.elo.ix.client.WFDiagram} toWorkflowTemplate Destination workflow template
   */
  addWorkflowTemplateWorkingVersion: function (fromWorkflowTemplate, toWorkflowTemplate) {
    var me = this,
        nextWorkflowVersionNo;

    if (!fromWorkflowTemplate) {
      throw "Source workflow template is empty";
    }

    if (!toWorkflowTemplate) {
      throw "Destination workflow template is empty";
    }

    nextWorkflowVersionNo = me.getNextWorkflowVersionNo(toWorkflowTemplate);

    // save old workflow version
    toWorkflowTemplate.version.id = -1;
    ixConnect.ix().checkinWorkflowTemplate(toWorkflowTemplate, WFDiagramC.mbAll, LockC.NO);

    // set update workflow as new working version
    fromWorkflowTemplate.id = toWorkflowTemplate.id;
    fromWorkflowTemplate.version.id = 0;
    fromWorkflowTemplate.version.version = nextWorkflowVersionNo + ".0";
    ixConnect.ix().checkinWorkflowTemplate(fromWorkflowTemplate, WFDiagramC.mbAll, LockC.NO);
  },

  /**
   * Returns the highest workflow template version number
   * @param  {de.elo.ix.client.WFDiagram} workflowTemplate Workflow template
   * @return {Number} Next workflow version number
   */
  getNextWorkflowVersionNo: function (workflowTemplate) {
    var workflowTemplateVersions, i, workflowTemplateVersion, currentWorkflowTemplateVersionNo, nextWorkflowVersionNo,
        highestWorkflowTemplateVersionNo = 0;

    if (!workflowTemplate) {
      throw "Workflow template is empty";
    }

    workflowTemplateVersions = ixConnect.ix().getWorkflowTemplateVersions(workflowTemplate.id + "", false);

    for (i = 0; i < workflowTemplateVersions.length; i++) {
      workflowTemplateVersion = workflowTemplateVersions[i];
      currentWorkflowTemplateVersionNo = parseInt(workflowTemplateVersion.version, 10);
      if (currentWorkflowTemplateVersionNo > highestWorkflowTemplateVersionNo) {
        highestWorkflowTemplateVersionNo = currentWorkflowTemplateVersionNo;
      }
    }

    nextWorkflowVersionNo = highestWorkflowTemplateVersionNo + 1;

    return nextWorkflowVersionNo;
  },

  /**
   * Deletes a workflow template ID
   * @param {String} workflowTemplateId Workflow template ID
   */
  deleteWorkflowTemplate: function (workflowTemplateId) {
    if (!workflowTemplateId) {
      throw "Workflow template ID is empty";
    }
    ixConnect.ix().deleteWorkflowTemplate(workflowTemplateId + "", "", LockC.NO);
  },

  /**
   * Returns the workflow template
   * @param {String} workflowTemplateId Workflow template ID
   * @return {String} Workflow ID
   */
  getWorkflowTemplate: function (workflowTemplateId) {
    if (!workflowTemplateId) {
      throw "Workflow template ID is empty";
    }
    var wfDiag = ixConnect.ix().checkoutWorkflowTemplate(workflowTemplateId + "", "", WFDiagramC.mbAll, LockC.NO);
    return wfDiag;
  },

  /**
   * This function parses the configuration object from a nodes comment.
   * The comment has to be valid JSON string.
   *
   * Additionally this method supports parsing the configuration from a config file (see {@link sol.common.ConfigMixin#parseConfiguration}).
   *
   * If $useTemplating: true is defined in the comment, the node's comment will be templated using handlebars.
   *
   * Should the workflow's sord be needed in templating, additionally, $useTemplateSord: true can be added to the comment.
   *
   * In addition there can be a variable number of string arguments for mandatory properties. If the configuration is missing one of those properties, an exception will be thrown.
   *
   *     var config = sol.common.ix.WfUtils.parseAndCheckParams(wf, 23, "objId", ...);
   *
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId The ID of the node
   * @return {Object}
   */
  parseAndCheckParams: function (workflow, nodeId) {
    var me = this,
        emptyArray = [],
        mandatoryProperties, node, commentString, comment, config, nodeComment;

    mandatoryProperties = (arguments.length > 2) ? emptyArray.slice.call(arguments, 2) : emptyArray;
    node = me.getNode(workflow, nodeId);

    nodeComment = node.comment + "";
    nodeComment = ((nodeComment.length > 0) && (nodeComment.trim().charAt(0) == "{")) ? nodeComment : "";

    commentString = String(node.properties) || nodeComment || "{}";

    try {
      comment = JSON.parse(commentString);

      if (comment.$useTemplating) {
        commentString = me.templateMixin(commentString, (comment.$useTemplateSord && workflow.objId), workflow.id);
        comment = JSON.parse(commentString);
      }

      config = sol.common.ConfigMixin.parseConfiguration(comment, undefined, true).config;
    } catch (ex) {
      me.logger.error(["error reading node config of node '{0}': {1}", node.name, commentString], ex);
      throw "configuration syntax error (node='" + node.name + "'): " + ex + " - config=" + commentString;
    }

    mandatoryProperties.forEach(function (property) {
      if (!config.hasOwnProperty(property)) {
        throw "configuration error: missing parameter '" + property + "'";
      }
    });

    return config;
  },

  /**
   * Applies handlebars template to mixin.
   * @param {Object} mixinString The config mixin string
   * @param {String} objId The WFDiagram's objId
   * @param {String} flowId The WFDiagram's flowId
   * @return {Object} Object which resulted from templating
   */
  templateMixin: function (mixinString, objId, flowId) {
    var me = this, sord, templatingData = {};

    if (!sol.common.TemplateUtils) {
      throw "$useTemplating and $useTemplateSord can only be used with IX scripts which include lib_sol.common.Template";
    }
    if (objId) {
      try {
        sord = (typeof ixConnectAdmin !== "undefined" ? ixConnectAdmin : ixConnect).ix().checkoutSord(objId, SordC.mbAllIndex, LockC.NO);
        templatingData.sord = me.getTemplateSord(sord, flowId, { formBlobs: true, asAdmin: true }).sord;
      } catch (_) {
        throw "could not create templatesord for templating workflowMixins.";
      }
    }
    return sol.common.TemplateUtils.render(mixinString, templatingData, { emptyNonRendered: true });
  },

  /**
   * Returns the node defined by the nodeId.
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} id The ID of the node
   * @return {de.elo.ix.client.WFNode} The node or null, if no node was found with the ID
   */
  getNode: function (workflow, id) {
    var node, i;
    for (i = 0; i < workflow.nodes.length; i++) {
      node = workflow.nodes[i];
      if ((node.id == id) && (node.type != WFNodeC.TYPE_NOTHING)) {
        return node;
      }
    }
    return null;
  },

  /**
   * Returns the name of the node.
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId
   * @return {String} The name of the node or null, if no node was found with the ID
   */
  getNodeName: function (workflow, nodeId) {
    var node = this.getNode(workflow, nodeId);
    return node ? node.name : null;
  },

  /**
   * Returns all active workflow nodes.
   * @param {de.elo.ix.client.WFDiagram} workflow
   * @return {de.elo.ix.client.WFNode[]}
   */
  getActiveNodes: function (workflow) {
    var nodes = [],
        i;
    for (i = 0; i < workflow.nodes.length; i++) {
      if (workflow.nodes[i].enterDateIso != "" && workflow.nodes[i].exitDateIso == "") {
        nodes.push(workflow.nodes[i]);
      }
    }
    return nodes;
  },

  /**
   * Returns all active workflow nodes with assigned users or groups.
   * @param {de.elo.ix.client.WFDiagram} workflow
   * @return {de.elo.ix.client.WFNode[]}
   */
  getActiveUserNodes: function (workflow) {
    var nodes = [],
        i, node;
    for (i = 0; i < workflow.nodes.length; i++) {
      node = workflow.nodes[i];
      if (node.enterDateIso != "" && node.exitDateIso == "" && node.userName != "") {
        nodes.push(node);
      }
    }
    return nodes;
  },

  /**
   * Returns the node for a node name.
   * If the node name is not unique, the first found node will be returned.
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} name The name of the node
   * @param {String}  (optional) Cycle number
   * @return {de.elo.ix.client.WFNode} The node or null, if no node was found with the name
   */
  getNodeByName: function (workflow, name, cycleNo) {
    var node, i;
    if (!workflow) {
      throw "Workflow diagram is empty";
    }
    if (!name) {
      throw "Name is empty";
    }
    for (i = 0; i < workflow.nodes.length; i++) {
      node = workflow.nodes[i];
      if ((node.name == name || node.nameTranslationKey == name) && (node.type != WFNodeC.TYPE_NOTHING)) {
        if (!cycleNo || sol.common.StringUtils.endsWith(node.name, "[[" + cycleNo + "]]")) {
          return node;
        }
      }
    }
    return null;
  },

  /**
   * Returns the node for a node ID.
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId Node ID
   * @return {de.elo.ix.client.WFNode} The node or null, if no node was found with the ID
   */
  getNodeById: function (workflow, nodeId) {
    var node, i;
    for (i = 0; i < workflow.nodes.length; i++) {
      node = workflow.nodes[i];
      if ((node.id == nodeId) && (node.type != WFNodeC.TYPE_NOTHING)) {
        return node;
      }
    }
    return null;
  },

  /**
   * Retrieves a list of user nodes which are previous to the node with the spezified ID.
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId The ID of the node
   * @return {de.elo.ix.client.WFNode[]}
   */
  getPreviousUserNodes: function (workflow, nodeId) {
    var me = this,
        assocs = workflow.matrix.assocs,
        prevNodes = [];

    assocs.forEach(function (assoc) {
      var node;
      if (assoc.nodeTo == nodeId) {
        node = me.getNode(workflow, assoc.nodeFrom);
        if (node && node.type == WFNodeC.TYPE_PERSONNODE) {
          prevNodes.push(node);
        } else {
          prevNodes = prevNodes.concat(me.getPreviousUserNodes(workflow, node.id));
        }
      }
    });

    return prevNodes;
  },

  /**
   * Retrieves a list of nodes which are successors to the node with the spezified ID.
   * The returned nodes could be filtered by type.
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId The ID of the node
   * @param {Number} filterType (optional) The number of the type (use de.elo.ix.client.WFNodeC.TYPE_* for the types)
   * @return {de.elo.ix.client.WFNode[]}
   */
  getSuccessorNodes: function (workflow, nodeId, filterType) {
    var me = this,
        assocs = workflow.matrix.assocs,
        succNodes = [];

    assocs.forEach(function (assoc) {
      var node;
      if (assoc.nodeFrom == nodeId) {
        node = me.getNode(workflow, assoc.nodeTo);
        if (!filterType || filterType == node.type) {
          succNodes.push(node);
        }
      }
    });

    return succNodes;
  },

  /**
   * Returns the successor node
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId The ID of the node
   * @param {Object} filterConfig Filte configuration
   * @param {Array} filterConfig.nameTranslationKeys Translation keys
   * @param {Array} filterConfig.iconNames Icon names
   * @return {de.elo.ix.client.WFNode}
   */
  getSuccessorNode: function (workflow, nodeId, filterConfig) {
    var me = this,
        succNodes;

    succNodes = me.getSuccessorNodes2(workflow, nodeId, filterConfig);

    if (succNodes.length > 1) {
      throw "More than one successor node found.";
    }

    if (succNodes.length == 1) {
      return succNodes[0];
    }
  },

  /**
   * Returns the successor nodes
   * @param {de.elo.ix.client.WFDiagram} workflow The WFDiagram containing the workflow description
   * @param {String} nodeId The ID of the node
   * @param {Object} filterConfig Filter configuration
   * @param {Array} filterConfig.nameTranslationKeys Translation keys
   * @param {Array} filterConfig.iconNames Icon names
   * @return {de.elo.ix.client.WFNode[]}
   */
  getSuccessorNodes2: function (workflow, nodeId, filterConfig) {
    var me = this,
        succNodes = [],
        assocs, assoc, i, j, node,
        nameTranslationKeys, nameTranslationKey,
        iconNames, iconGuid;

    assocs = workflow.matrix.assocs;

    for (i = 0; i < assocs.length; i++) {
      assoc = assocs[i];
      if (assoc.nodeFrom == nodeId) {
        node = me.getNode(workflow, assoc.nodeTo);
        if (filterConfig) {
          if (filterConfig.nameTranslationKeys) {
            nameTranslationKeys = filterConfig.nameTranslationKeys;
            for (j = 0; j < nameTranslationKeys.length; j++) {
              nameTranslationKey = nameTranslationKeys[j];
              if (node.nameTranslationKey == nameTranslationKey) {
                succNodes.push(node);
                continue;
              }
            }
          }
          if (filterConfig.iconNames) {
            iconNames = filterConfig.iconNames;
            for (j = 0; j < iconNames.length; j++) {
              iconGuid = me.getWorkflowIconGuid(iconNames[j]);
              if (iconGuid && (node.iconId == iconGuid)) {
                succNodes.push(node);
              }
            }
          }
        } else {
          succNodes.push(node);
        }
      }
    }

    return me.getUniqueNodes(succNodes);
  },

  /**
   * Returns the guid of a workflow icon
   * @param {String} iconName Icon name
   * @return {String} Workflow icon GUID
   */
  getWorkflowIconGuid: function (iconName) {
    var me = this,
        guid;
    if (!me.workflowIconGuids) {
      me.readWorkflowIconGuids();
    }
    guid = me.workflowIconGuids[iconName];
    return guid;
  },

  /**
   * Activates associations
   * @param  {de.elo.ix.client.WFNodeAssoc[]} assocs Associations
   */
  activateAssocs: function (assocs) {
    var me = this;
    if (!assocs || (assocs.length == 0)) {
      return;
    }
    assocs.forEach(function (assoc) {
      me.logger.debug(["Activate association: nodeFrom={0}, nodeTo={1}, assocType={2}", assoc.nodeFrom, assoc.nodeTo, assoc.type]);
      assoc.done = true;
    });
  },

  workflowIconFolderGuid: "(E10E1000-E100-E100-E100-E10E10E10EE0)",

  /**
   * Reads the workflow icon IDs
   * @private
   */
  readWorkflowIconGuids: function () {
    var me = this,
        wfIconGuids = {},
        sords;

    sords = sol.common.RepoUtils.findChildren(me.workflowIconFolderGuid, { includeDocuments: true, includeReferences: true, sordZ: SordC.mbMin });
    sords.forEach(function (sord) {
      wfIconGuids[sord.name] = sord.guid;
    });
    me.workflowIconGuids = wfIconGuids;
  },

  /**
   * Returns a list of unique workflow nodes
   * @param {Array} nodes Workflow nodes
   * @returns {Array} Unique workflow nodes
   */
  getUniqueNodes: function (nodes) {
    var key,
        nodesObj = {},
        filteredNodes = [];

    if (!nodes) {
      throw "Nodes array must be given";
    }
    nodes.forEach(function (node) {
      nodesObj[String(node.id)] = node;
    });
    for (key in nodesObj) {
      if (nodesObj.hasOwnProperty(key)) {
        filteredNodes.push(nodesObj[key]);
      }
    }
    return filteredNodes;
  },

  /**
   * Forward a workflow
   * @param {String} flowId Workflow ID
   * @param {String} currentNodeId Current node ID
   * @param {Array} successorNodeIds Successor node IDs
   * @param {Object} options Function options object
   * @param {de.elo.ix.client.IXConnection} options.connection Custom index server connection
   */
  forwardWorkflow: function (flowId, currentNodeId, successorNodeIds, options) {
    var me = this,
        connection, forwardWorkflowNodeInfo;

    options = options || {};

    if (!flowId) {
      throw "Flow ID is empty";
    }

    if (!currentNodeId) {
      throw "Current node ID is empty";
    }

    if (!successorNodeIds) {
      throw "Successor node IDs are empty";
    }

    successorNodeIds = successorNodeIds.map(function (successorNodeId) {
      return java.lang.Integer.parseInt(successorNodeId);
    });

    connection = options.connection || ixConnect;

    connection.ix().beginEditWorkFlowNode(flowId, currentNodeId, LockC.YES);

    forwardWorkflowNodeInfo = new ForwardWorkflowNodeInfo();
    forwardWorkflowNodeInfo.successorNodesToActivate = successorNodeIds;
    connection.ix().forwardWorkflowNode(flowId, currentNodeId, forwardWorkflowNodeInfo, LockC.YES);

    me.logger.debug(["Workflow forwarded (flowId={0}, currentNodeId={1}, destinationNodeIds={2})", flowId, currentNodeId, successorNodeIds]);
  },

  /**
   * Changes the user of a node.
   * @param {de.elo.ix.client.WFNode} node The node to be changed
   * @param {String} user The user which should be set
   * @param {Object} params Parameters
   * @param {Boolean} [params.changeDesignDepartment=false] Change also the property `designDepartment`
   */
  changeNodeUser: function (node, user, params) {
    var me = this,
        userInfo;

    params = params || {};

    if (node) {
      if (node.userName != user) {
        me.logger.debug(["changeNodeUser: node.name={0}, node.userName={1}", node.name, user]);
        node.userName = user;
        node.userId = -1;
        if (params.changeDesignDepartment) {
          userInfo = sol.common.UserUtils.getUserInfo(user);
          if (userInfo) {
            me.logger.debug(["changeNodeUser: node.name={0}, node.designDepartment={1}, node.designDepartmentName={2}", node.name, userInfo.id, userInfo.name]);
            node.designDepartment = userInfo.id;
          }
        }
      }
    } else {
      this.logger.warn("'node' cannot be empty, no user set.");
    }
  },

  /**
   * Sets node escalations
   * @param {de.elo.ix.client.WFNode} node The node to be changed
   * @param {Object[]} nodeEscalations Node escalations
   * @param {Object} nodeEscalations.user Node escalation user
   * @param {String} nodeEscalations.user.value Node escalation user name
   * @param {Boolean} nodeEscalations.user.supervisor Escalate to the users supervisor
   * @param {Number} nodeEscalations.timeLimitMinutes Node escalation minutes
   *
   * Example:
   *     [
   *       { "timeLimitMinutes": 1, "user": { "value": "User1" } }
   *     ]
   *
   * @param {String} defaultUserName Default user name
   *
   */
  setNodeEscalations: function (node, nodeEscalations, defaultUserName) {
    var me = this,
        i, nodeEscalation, userName;

    nodeEscalations = nodeEscalations || [];

    if (!node) {
      throw "Node is empty";
    }

    if (!nodeEscalations || !nodeEscalations.length) {
      return;
    }

    for (i = 0; i < 2; i++) {
      nodeEscalation = nodeEscalations[i];
      if (!nodeEscalation) {
        continue;
      }

      userName = (nodeEscalation.user && (typeof nodeEscalation.user.value != "undefined")) ? nodeEscalation.user.value : defaultUserName;

      if (nodeEscalation.user && (nodeEscalation.user.supervisor === true)) {
        userName = sol.common.UserUtils.getSupervisor(userName);
      }

      node.timeLimitEscalations[i].userId = -1;
      node.timeLimitEscalations[i].userName = userName;

      if (typeof nodeEscalation.timeLimitMinutes != "undefined") {
        node.timeLimitEscalations[i].timeLimit = nodeEscalation.timeLimitMinutes;
      }

      me.logger.debug(["Set escalation {0}: node.name={1}, userName={2}", i + "", node.name + "", userName + ""]);
    }
  },

  /**
   * Changes the name of a node.
   * @param {de.elo.ix.client.WFNode} node The node to be changed
   * @param {String} name The new node name
   */
  changeNodeName: function (node, name) {
    if (node) {
      node.name = name;
    } else {
      this.logger.warn("'node' cannot be empty, name not changed.");
    }
  },

  /**
   * Appends a String to a nodes comment field.
   * @param {de.elo.ix.client.WFNode} node The node to be changed
   * @param {String} comment
   * @param {Boolean} override (optional) If `true`, an existing comment will be overridden
   */
  appendNodeComment: function (node, comment, override) {
    comment = comment || "";
    if (override) {
      node.comment = comment;
      return;
    }

    if (node.comment && node.comment.length() > 0) {
      node.comment += "\n";
    }
    node.comment += comment;
  },

  /**
   * Finds the first active node of a specific object and workflow
   * and returns the node ID and the URL.
   * @param {String} objId Object ID
   * @param {String} flowId Flow ID
   * @return {Object} nodeId, url. Node ID and URL
   */
  findFirstActiveNodeWithUrl: function (objId, flowId) {
    var me = this,
        wfCollectNode, url;
    wfCollectNode = me.findFirstActiveNode(objId, flowId);
    if (wfCollectNode) {
      url = me.getFormUrl(wfCollectNode);
      return { nodeId: wfCollectNode.nodeId, url: url };
    }
  },

  /**
   * Finds the first active Node of a specific object and workflow
   * @param {String} objId Object ID
   * @param {String} flowId Flow ID
   * @return {de.elo.ix.client.WFCollectNode} wfCollectNode. Found active node.
   */
  findFirstActiveNode: function (objId, flowId) {
    var me = this,
        findTasksInfo, idx, findResult, tasks, i, wfCollectNode;

    me.logger.enter("findFirstActiveNode", { objId: objId, flowId: flowId });

    findTasksInfo = new FindTasksInfo();
    findTasksInfo.inclWorkflows = true;
    findTasksInfo.lowestPriority = UserTaskPriorityC.LOWEST;
    findTasksInfo.highestPriority = UserTaskPriorityC.HIGHEST;
    findTasksInfo.objId = objId;

    idx = 0;
    findResult = ixConnect.ix().findFirstTasks(findTasksInfo, 100);

    while (true) {
      tasks = findResult.tasks;
      for (i = 0; i < tasks.length; i++) {
        wfCollectNode = tasks[i].wfNode;
        if ((wfCollectNode.flowId == flowId) || (wfCollectNode.parentFlowId == flowId)) {
          me.logger.debug(["found active node for workflow (flowId={0}, nodeName={1}, nodeId={2})", wfCollectNode.flowId, wfCollectNode.nodeName, wfCollectNode.nodeId]);
          me.logger.exit("findFirstActiveNode");
          return wfCollectNode;
        }
      }

      if (!findResult.isMoreResults()) {
        break;
      }

      idx += findResult.tasks.length;
      findResult = ixConnect.ix().findNextTasks(findResult.searchId, idx, 100);
    }

    if (findResult) {
      ixConnect.ix().findClose(findResult.searchId);
    }

    me.logger.debug(["no active node found for flowId={0}", flowId]);
    me.logger.exit("findFirstActiveNode");
    return null;
  },

  /**
   * Returns the ELOwf form URL of a specified node
   * @param {de.elo.ix.client.WFCollectNode} wfCollectNode
   * @return {String} url URL of the ELOwf form
   */
  getFormUrl: function (wfCollectNode) {
    var me = this,
        formName, baseUrl, url,
        urlParams = [];
    urlParams.push("wfid=" + wfCollectNode.flowId);
    urlParams.push("nodeid=" + wfCollectNode.nodeId);
    urlParams.push("ticket=" + ixConnect.loginResult.clientInfo.ticket);
    urlParams.push("lang=" + ixConnect.loginResult.clientInfo.language);

    formName = me.getFormName(wfCollectNode);
    baseUrl = me.getWfBaseUrl();

    if (!formName || !baseUrl) {
      return "";
    }

    url = baseUrl + "/" + formName + ".jsp?" + urlParams.join("&");
    return url;
  },

  wfUrlCache: {},

  /**
   * Returns the ELOwf base URL
   * @param {Object} params Parameters
   * @param {String} params.ixUrl IX URL to derive WF URL
   * @return {String} url. ELOwf base URL.
   */
  getWfBaseUrl: function (params) {
    var me = this,
        ixVersion, ixUrl, ixUrlKey, cachedWfUrl, wfBaseUrl, globalProfile;

    params = params || {};
    ixUrl = (params.ixUrl || "") + "";

    ixUrlKey = ixUrl ? ixUrl : "empty";

    cachedWfUrl = me.wfUrlCache[ixUrlKey];

    if (cachedWfUrl) {
      return cachedWfUrl;
    }

    ixVersion = ixConnect.implVersion + "";

    // For ELO versions 2x (20, 21 etc.) the proxy WF URL should be used
    if (ixVersion.substring(0, 1) == "2") {
      if (!ixUrl) {
        ixUrl = sol.common.RepoUtils.getIxOption("publicUrlBase");
      }
      if (!ixUrl) {
        ixUrl = ixConnect.endpointUrl + "";
      }
      wfBaseUrl = ixUrl.substring(0, ixUrl.length - 3) + "/plugin/de.elo.ix.plugin.proxy/wf";
    } else {
      globalProfile = sol.create("sol.common.UserProfile", { userId: UserProfileC.USERID_ALL });
      wfBaseUrl = String(globalProfile.getOption("Client.1398.1.0.Options.EloWfUrl.")).replace(/\/$/, "");
    }

    me.wfUrlCache[ixUrlKey] = wfBaseUrl;

    return wfBaseUrl;
  },

  /**
   * Checks wether the ELOwf is running
   * @return {Object}
   * @return {Boolean} httpResponse.isRunning
   */
  checkWfIsRunning: function () {
    var me = this,
        wfStatusUrl, httpResponse;

    wfStatusUrl = me.getWfBaseUrl() + "/wf?__cmd__=status";

    httpResponse = sol.common.HttpUtils.sendRequest({ url: wfStatusUrl, resolve: false, connectTimeout: 3000, readTimeout: 10000 });

    if (httpResponse.responseOk && (httpResponse.content.indexOf(">ELOwf Status Report<") > -1) && (httpResponse.content.indexOf(">Running<") > -1)) {
      httpResponse.isRunning = true;
    } else {
      httpResponse.isRunning = false;
    }

    return httpResponse;
  },

  /**
   * Returns form name of a specified node
   * @param {de.elo.ix.client.WFCollectNode} wfCollectNode
   * @return {String} formName. Form name.
   */
  getFormName: function (wfCollectNode) {
    var me = this,
        formStartPos, formEndPos,
        formSpec = String(wfCollectNode.formSpec);
    if (!formSpec) {
      me.logger.warn("Property 'formSpec' is empty: node.name=" + wfCollectNode.name);
      return "";
    }
    formStartPos = formSpec.indexOf("[") + 1;
    formEndPos = formSpec.indexOf("(");
    return formSpec.substring(formStartPos, formEndPos);
  },

  /**
   * Creates a template workflow node from a WFDiagram (see {@link sol.common.ObjectFormatter.TemplateWfDiagramNode TemplateWfDiagramNode}).
   * @param {de.elo.ix.client.WFDiagram} wfDiagram
   * @param {Number} nodeId
   * @return {Object}
   */
  getTemplateWfDiagramNode: function (wfDiagram, nodeId) {
    if (!wfDiagram) {
      throw "wfDiagram is empty";
    }
    if (!nodeId) {
      throw "Node ID is empty";
    }

    return sol.common.ObjectFormatter.format({
      node: {
        formatter: "sol.common.ObjectFormatter.TemplateWfDiagramNode",
        data: wfDiagram,
        config: {
          flowId: wfDiagram.id,
          nodeId: nodeId
        }
      }
    });
  },

  /**
   * Retrieves a map value from a workflow.
   * @param {String} flowId Flow ID
   * @param {String} key Map key
   * @return {String} value
   */
  getWfMapValue: function (flowId, key) {
    var tmpValue,
        value = "";

    tmpValue = ixConnect.ix().checkoutMap(MapDomainC.DOMAIN_WORKFLOW_ACTIVE, flowId, [key], LockC.NO).items;
    if (tmpValue && tmpValue.length == 1) {
      value = tmpValue[0].value;
    }
    return value;
  },

  /**
   * Sets a map value from a workflow.
   * @param {Number} objId Flow ID
   * @param {String} flowId Flow ID
   * @param {String} key Map key
   * @param {String|Array} values Value
   */
  setWfMapValue: function (objId, flowId, key, values) {
    var i,
        keyValues = [];

    if (!objId) {
      throw "Object ID is empty";
    }

    if (!flowId) {
      throw "Flow ID is empty";
    }

    if (!key) {
      throw "Map key is empty";
    }
    values = values || "";

    objId = parseInt(objId, 10);

    if (sol.common.ObjectUtils.isArray(values)) {
      for (i = 1; i <= values.length; i++) {
        keyValues.push(new KeyValue(key + i, values[i - 1]));
      }
      keyValues.push(new KeyValue(key + i, ""));
    } else {
      keyValues.push(new KeyValue(key, values));
    }

    ixConnect.ix().checkinMap(MapDomainC.DOMAIN_WORKFLOW_ACTIVE, flowId, objId, keyValues, LockC.NO);
  },

  /**
   * Get node User
   * @param {de.elo.ix.client.WFDiagram} wfDiagram Workflow diagram
   * @param {String} nodeId Node ID
   * @param {Object} config Configuration
   * @param {Boolean} config.useSessionUserAlternatively
   * @return {String} Node user
   */
  getNodeUser: function (wfDiagram, nodeId, config) {
    var me = this,
        wfNode,
        nodeUser = "";

    config = config || {};

    if (wfDiagram && nodeId) {
      wfNode = me.getNode(wfDiagram, nodeId);
      nodeUser = String(wfNode.userName);
    }

    if (!nodeUser && config.useSessionUserAlternatively) {
      nodeUser = String(ixConnect.loginResult.user.name);
    }
    return nodeUser;
  },

  /**
   * Returns the cycle number
   * @param {String} nodeName Node name
   * @return {String}
   */
  getCycleNumber: function (nodeName) {
    var matches;

    matches = String(nodeName).match(/(\[\[)(\d+)(\]\]$)/);
    if (matches && (matches.length == 4)) {
      return matches[2];
    }
  },

  /**
   * Appends the cycle number to a node name
   * @param {String} nodeName Node name
   * @param {String} cycleNo Cycle number
   * @return {String}
   */
  appendCycleNumber: function (nodeName, cycleNo) {
    return cycleNo ? nodeName + " [[" + cycleNo + "]]" : nodeName;
  },

  /**
   * Retrieves the prefix for service workflows from the `serviceWfPrefix` property from `base.config` file.
   * @return {String}
   */
  getServiceWfPrefix: function () {
    var me = this;
    return me.loadBaseConfig().serviceWfPrefix;
  },

  /**
   * Checks, if the workflow template was created of a user with main admin rights.
   * @param {de.elo.ix.client.WFDiagram} wfDiagram
   */
  checkMainAdminWf: function (wfDiagram) {
    var creator;
    creator = (wfDiagram && wfDiagram.version) ? wfDiagram.version.userId : "";

    if (creator == -1) {
      throw "Workflow creator ID is not valid: userId=" + creator;
    }

    if (!sol.common.UserUtils.isMainAdmin(creator)) {
      throw "This workflow uses an admin function node. Hence this workflow template has to be created by an administrative user. It was created by '" + +(creator) + "'";
    }
  },

  /**
   * Checks, if a workflow was started from a service.
   *
   * Currently this is determined by the prefix at the workflow name retrieved by {@link #getServiceWfPrefix}.
   * @param {de.elo.ix.client.WFDiagram} wfDiagram
   * @return {Boolean}
   */
  isServiceWf: function (wfDiagram) {
    var me = this,
        prefix, wfName, isServiceWf;
    me.logger.enter("isServiceWf", arguments);
    prefix = me.getServiceWfPrefix();
    wfName = wfDiagram.name;
    isServiceWf = sol.common.StringUtils.startsWith(wfName, prefix);
    me.logger.exit("isServiceWf", { isServiceWf: isServiceWf });
    return isServiceWf;
  },

  /**
   * Creates the name for a service workflow from a given name.
   *
   * Currently this is implemented by using the value retrieved by {@link #getServiceWfPrefix} as prefix.
   * @param {String} wfName
   * @return {String}
   */
  createServiceWfName: function (wfName) {
    var me = this,
        prefix;
    me.logger.enter("createServiceWfName", arguments);
    prefix = me.getServiceWfPrefix();
    if (prefix) {
      wfName = prefix + wfName;
    }
    me.logger.exit("createServiceWfName", { wfName: wfName });
    return wfName;
  },

  /**
   * Sets the session option ´Start docmask workflows´
   * @param {Boolean} startDocMaskWorkflows Start doc mask workflows
   */
  setSessionOptionStartDocMaskWorkflows: function (startDocMaskWorkflows) {
    var sessionOptions;

    if (typeof startDocMaskWorkflows !== "boolean") {
      return;
    }
    sessionOptions = {};
    sessionOptions[SessionOptionsC.START_DOCMASK_WORKFLOWS] = startDocMaskWorkflows ? "true" : "false";

    sol.common.RepoUtils.setSessionOptions(sessionOptions);
  },

  /**
   * Returns a template sord including wfMap data
   * @param {de.elo.ix.client.Sord} sord sord for object formatter
   * @param {String} flowId Workflow id of workflow map
   * @param {Object} options Options
   * @param {Boolean} options.asAdmin As admin
   * @return {Object} Template Sord
   */
  getTemplateSord: function (sord, flowId, options) {
    var me = this,
        templateSord;

    me.logger.enter("getTemplateSord", arguments);
    templateSord = sol.common.ObjectFormatter.format({
      sord: {
        formatter: "sol.common.ObjectFormatter.WfMap",
        data: sord,
        config: {
          sordKeys: ["id", "guid", "maskName", "name", "desc", "IDateIso", "XDateIso", "ownerName"],
          allMapFields: true,
          allFormBlobFields: (options && options.formBlobs === true),
          flowId: flowId,
          asAdmin: (options && options.asAdmin) || false
        }
      }
    });
    me.logger.exit("getTemplateSord");
    return templateSord;
  },

  /**
   * Creates a new reminder.
   * @since 1.04.000
   * @param {String} objId
   * @param {Object} params (optional) Additional parameters
   * @param {String[]} params.userIds (optional) The user ids of the reminder receivers. Default is the IX connection user.
   * @param {String} params.name (optional) The name for the reminder. Default is `sord.name`.
   * @param {String} params.promptDateIso (optional) The date (as ISO string) when the reminder will be set visible for the user. Defualt is the current date.
   * @return {Number[]} The reminder ids. There will be one reminderfor each user in `params.userIds` if defined or one reminder for the current user.
   */
  createReminder: function (objId, params) {
    var me = this,
        name, promptDate, receiverIds, reminder, reminderIds;

    name = (params && params.name) ? params.name : ixConnect.ix().checkoutSord(objId, SordC.mbMin, LockC.NO).name;
    promptDate = (params && params.promptDateIso) ? params.promptDateIso : sol.common.DateUtils.dateToIso(new Date());
    receiverIds = (params && params.userIds) ? params.userIds : [ixConnect.loginResult.user.id];

    reminder = ixConnect.ix().createReminder(objId);
    reminder.name = name;
    reminder.promptDateIso = promptDate;
    reminderIds = ixConnect.ix().checkinReminder(reminder, receiverIds, false, LockC.NO);

    me.logger.info(["reminder created: objId={0}, users={1}", objId, receiverIds.join(",")]);

    return reminderIds;
  },

  /**
   * Checks if the passed node is from type WFNodeC.TYPE_CALL_SUB_WORKFLOW
   * @param {de.elo.ix.client.WFNode} node which should be checked
   */
  isSubworkflowNode: function (node) {
    return node && node.type === WFNodeC.TYPE_CALL_SUB_WORKFLOW;
  },

  /**
   * Returns the URL to an ELO App.
   * @since 1.16.000
   * @param {String} appName Name of the ELO App
   * @param {Object} params (optional) Additional parameters. Key and Value pairs which will be added to the appUrl
   * @return {String} URL to ELO App
   */
  getAppUrl: function (appName, params) {
    var me = this,
        wfUrl, appUrl, key, paramArr = [];

    params = params || {};

    if (!appName) {
      throw "'appName' ist empty";
    }

    wfUrl = me.getWfBaseUrl();
    appUrl = wfUrl + "/apps/app/" + appName + "/";

    for (key in params) {
      paramArr.push(encodeURI(key) + "=" + encodeURI(params[key]));
    }

    if (paramArr.length > 0) {
      appUrl += "?" + paramArr.join("&");
    }

    return appUrl;
  }
});


