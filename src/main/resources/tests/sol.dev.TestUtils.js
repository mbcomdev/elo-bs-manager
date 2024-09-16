
(function (global) {
  function TestUtils() {
    var createdSordIds = [],
        testUtils;

    testUtils = {
      createAndCheckinSords: function (params, amount) {
        return (testUtils.createEmptyArray(amount))
          .map(function () {
            return testUtils.createAndCheckinSord(params);
          });
      },
      createEmptyArray: function (amount) {
        var arr = [];
        while (amount-- > 0) {
          arr.push(undefined);
        }
        return arr;
      },
      createAndCheckinSord: function (params) {
        var tempSord, preparedParams;
        try {
          preparedParams = testUtils.prepareParams(params);
          tempSord = testUtils.checkoutSord(
            testUtils.checkinSord(
              testUtils.createSord(preparedParams || {})
            )
          );

          if (testUtils.shouldCheckinMap(preparedParams.entries)) {
            testUtils.checkinMap(tempSord, testUtils.getMapEntries(preparedParams.entries));
          }
        } catch (error) {
          log.info("error {}", error);
        }

        return tempSord;
      },
      createSord: function (params) {
        var createdSord = ixConnect.ix().createSord(
          params.parentId || "1",
          params.mask || "Basic Entry",
          EditInfoC.mbSord
        ).sord;

        if (params.entries) {
          createdSord = testUtils.setObjKeys(createdSord, params.entries);
        }
        return createdSord;
      },
      prepareParams: function (params) {

        if (!params) {
          return;
        }

        if (!params.entries) {
          params.entries = [];
        }

        if (params.objKeys) {
          params.entries = params.entries.concat(Object.keys(params.objKeys)
            .map(function (key) {
              return { type: "GRP", key: key, value: params.objKeys[key] };
            }));
        }
        if (params.mapKeys) {
          params.entries = params.entries.concat(Object.keys(params.mapKeys)
            .map(function (key) {
              return { type: "MAP", key: key, value: params.mapKeys[key] };
            }));
        }

        return params;
      },
      checkinSord: function (sord) {
        var previousSordId = sord.id,
            sordId;

        sordId = ixConnect.ix().checkinSord(sord, SordC.mbAllIndex, LockC.NO);
        if (testUtils.shouldAddToCreatedSord(previousSordId, sordId)) {
          testUtils.addToCreatedSords(sordId);
        }
        return sordId;
      },
      checkoutSord: function (sordId) {
        return ixConnect.ix().checkoutSord(sordId, SordC.mbAllIndex, LockC.NO);
      },

      createUser: function (userName) {
        var userInfo, userIds;

        userInfo = ixConnect.ix().createUser(null);
        userInfo.name = userName;
        userIds = ixConnect.ix().checkinUsers([userInfo], CheckinUsersC.NEW_USER, LockC.NO);
        if (userIds && (userIds.length == 1)) {
          return userIds[0];
        }
      },

      deleteUser: function (userId) {
        ixConnect.ix().deleteUser(userId, LockC.NO);
      },

      shouldAddToCreatedSord: function (previousSordId, currentSordId) {
        return previousSordId == -1
          && createdSordIds.indexOf(currentSordId) == -1
          && currentSordId != -1;
      },
      addToCreatedSords: function (sordId) {
        createdSordIds.push(sordId);
      },
      shouldCheckinMap: function (entries) {
        return testUtils.getMapEntries(entries).length > 0;
      },
      getMapEntries: function (entries) {
        return (entries || [])
          .filter(function (entry) {
            return entry.type == "MAP";
          });
      },
      setObjKeysAndCheckin: function (sord, entries) {
        testUtils.checkinSord(
          testUtils.setObjKeys(sord, entries)
        );
      },
      setObjKeys: function (sord, entries) {
        sord.objKeys = entries
          .filter(function (entry) {
            return entry.type == "GRP";
          })
          .reduce(function (objKeys, entry) {
            return objKeys
              .map(function (sordObjKey) {
                if (sordObjKey.name == entry.key) {
                  sordObjKey.data = Array.isArray(entry.value) ? entry.value : [entry.value];
                }
                return sordObjKey;
              });
          }, Array.prototype.slice.call(sord.objKeys));
        return sord;
      },
      checkinMap: function (sord, mapEntries) {
        var entries = mapEntries.map(testUtils.getKeyValuesFromMapEntry);
        ixConnect.ix().checkinMap(
          MapDomainC.DOMAIN_SORD,
          sord.id,
          sord.id,
          entries,
          LockC.NO);
      },
      getKeyValuesFromMapEntry: function (entry) {
        return new KeyValue(entry.key, entry.value);
      },
      cleanUp: function () {
        createdSordIds
          .map(function (objId) {
            ixConnectAdmin.ix().deleteSord("1", objId + "", LockC.NO, null);
          });
      }
    };

    return testUtils;
  }

  global.TestUtils = TestUtils();
})(this);