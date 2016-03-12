'use strict';

var path = require('path');

var fs = require('fs');

var detective = require('detective');

var immutable = require('immutable');

var Promise = require('pinkie-promise');

var FOREIGN_BASE_NAME = 'foreign';

var FOREIGN_FILE_NAME = FOREIGN_BASE_NAME + '.js';

var SRC_FILE_NAME = 'index.js';

function emptyMap() {
  return immutable.Map();
}
module.exports.emptyMap = emptyMap;

function isFileUnmodified(file,
                          srcModuleMap,
                          ffiModuleMap,
                          srcModificationMap1,
                          srcModificationMap2,
                          ffiModificationMap1,
                          ffiModificationMap2) {
  function getModuleName(file) {
    return path.basename(path.dirname(file));
  }

  function check(moduleMap, modificationMap1, modificationMap2) {
    var moduleName = getModuleName(file);

    var moduleFile = moduleMap.get(moduleName);

    var previous = modificationMap1.get(moduleFile);

    var current = modificationMap2.get(moduleFile);

    var isUnmodified = previous && current && previous >= current;

    return isUnmodified;
  }

  var base = path.basename(file);

  if (base === FOREIGN_FILE_NAME) {
    return check(ffiModuleMap, ffiModificationMap1, ffiModificationMap2);
  }
  else {
    return check(srcModuleMap, srcModificationMap1, srcModificationMap2);
  }
}

function findRequires(file, callback) {
  fs.readFile(file, {encoding: 'utf-8'}, function(error, result){
    if (error) callback(error, null);
    else {
      var requires = detective(result);
      callback(null, requires);
    }
  });
}

function insertOutput(output,
                      requireMap,
                      srcModuleMap,
                      ffiModuleMap,
                      srcModificationMap1,
                      srcModificationMap2,
                      ffiModificationMap1,
                      ffiModificationMap2,
                      callback) {
  var promise =
    output.reduce(function(result, file){
      return result.then(function(map_){
        return new Promise(function(resolve, reject){
          var isUnmodified = isFileUnmodified(file,
                                              srcModuleMap,
                                              ffiModuleMap,
                                              srcModificationMap1,
                                              srcModificationMap2,
                                              ffiModificationMap1,
                                              ffiModificationMap2);

          if (isUnmodified) resolve(map_);
          else {
            findRequires(file, function(error, requires){
              if (error) reject(error);
              else {
                var fileDir = path.dirname(file);

                var resolved = requires.map(function(require_){
                  var result = path.resolve(fileDir, require_);

                  var dir = path.dirname(result);

                  var base = path.basename(result);

                  var base_ = base === FOREIGN_BASE_NAME ? FOREIGN_FILE_NAME : path.join(base, SRC_FILE_NAME);

                  return path.join(dir, base_);
                });

                var updated = map_.set(file, resolved);

                resolve(updated);
              }
            });
          }
        });
      });
    }, Promise.resolve(requireMap))
  ;

  promise.then(
    function(result){callback(null, result)},
    function(error){callback(error, null)}
  );
}
module.exports.insertOutput = insertOutput;
