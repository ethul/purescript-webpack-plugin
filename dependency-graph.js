'use strict';

var path = require('path');

var dependencyGraph = require('dependency-graph');

function insertFromOutput(files, requireMap, srcModuleMap, ffiModuleMap, graph, callback) {
  function getModuleName(file) {
    return path.basename(path.dirname(file));
  }

  var graph_ =
    files.reduce(function(result, file){
      var moduleName = getModuleName(file);

      var srcResult = srcModuleMap.get(moduleName);

      var ffiResult = ffiModuleMap.get(moduleName);

      if (srcResult) {
        graph.addNode(srcResult);
      }

      if (ffiResult) {
        graph.addNode(ffiResult);

        if (srcResult) {
          graph.addDependency(srcResult, ffiResult);
        }
      }

      var requires = requireMap.get(file) || [];

      requires.forEach(function(require_){
        var requireModuleName = getModuleName(require_);

        var requireSrcResult = srcModuleMap.get(requireModuleName);

        var requireFFIResult = ffiModuleMap.get(requireModuleName);

        if (requireSrcResult) {
          graph.addNode(requireSrcResult);

          if (srcResult && srcResult !== requireSrcResult) {
            graph.addDependency(srcResult, requireSrcResult);
          }
        }

        if (requireFFIResult) {
          graph.addNode(requireFFIResult);

          if (requireSrcResult) {
            graph.addDependency(requireSrcResult, requireFFIResult);
          }
        }
      });

      return graph;
    }, graph)
  ;

  callback(null, graph_);
}
module.exports.insertFromOutput = insertFromOutput;

function emptyGraph() {
  return new dependencyGraph.DepGraph();
}
module.exports.emptyGraph = emptyGraph;
