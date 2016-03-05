'use strict';

var path = require('path');

var fs = require('fs');

var immutable = require('immutable');

var Promise = require('pinkie-promise');

function emptyMap() {
  return immutable.Map();
}
module.exports.emptyMap = emptyMap;

function modifiedTime(file, callback) {
  fs.stat(file, function(error, result){
    if (error) callback(error, null);
    else {
      var millis = result.mtime.valueOf();
      callback(null, millis);
    }
  });
}

function insert(files, map, callback) {
  var promise =
    files.reduce(function(result, file){
      return result.then(function(map_){
        return new Promise(function(resolve, reject){
          modifiedTime(file, function(error, mtime){
            if (error) reject(error);
            else {
              var value = mtime.valueOf();

              var updated = map_.set(file, value);

              resolve(updated);
            }
          });
        });
      });
    }, Promise.resolve(map));

  promise.then(
    function(result){callback(null, result)},
    function(error){callback(error, null)}
  );
}
module.exports.insert = insert;
