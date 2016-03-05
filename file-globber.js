'use strict';

var path = require('path');

var globby = require('globby');

var cwd = process.cwd();

function glob(globs, callback) {
  var promise =
    globby(globs).then(function(files){
      return files.map(function(file){
        var file_ = path.join(cwd, file);
        return file_;
      });
    })
  ;

  promise.then(
    function(result){callback(null, result)},
    function(error){callback(error, null)}
  );
}

module.exports.glob = glob;
