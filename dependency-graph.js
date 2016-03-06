'use strict';

var acorn = require('acorn');

var walk = require('acorn/dist/walk');

var dependencyGraph = require('dependency-graph');

function onAssignmentExpression(namespace) {
  function handler(node, state) {
    if (node.operator === '=') {
      if (node.left && node.left.object &&
          node.left.type === 'MemberExpression' &&
          node.left.object.name === namespace) {
        if (node.right && node.right.left && node.right.left.object &&
            node.right.type === 'LogicalExpression' &&
            node.right.left.object.name === namespace) {
          var value = node.left.property.value;
          if (!state.modules[value]) {
            state.modules[value] = state.cache;
          }
          else {
            var existing = state.modules[value];
            state.modules[value] = {
              src: existing.src.concat(state.cache.src),
              ffi: existing.ffi.concat(state.cache.ffi)
            }
          }
          state.cache = {src: [], ffi: []};
        }
      }
    }
  }

  return handler;
}

function onVariableDeclarator(namespace) {
  function handler(node, state) {
    if (node.id && node.init && node.init.object && node.init.property &&
        node.id.type === 'Identifier' &&
        node.init.type === 'MemberExpression' &&
        node.init.object.type === 'Identifier' &&
        node.init.object.name === namespace) {
      var value = node.init.property.value;
      if (node.id.name === '$foreign') {
        state.cache.ffi.push(value);
      }
      else {
        state.cache.src.push(value);
      }
    }
  }

  return handler;
}

function insertFromBundle(bundle, namespace, graph, callback) {
  var ast = acorn.parse(bundle, {ecmaVersion: 5});

  var state = {modules: {}, cache: {src: [], ffi: []}};

  walk.simple(ast, {
    AssignmentExpression: onAssignmentExpression(namespace),
    VariableDeclarator: onVariableDeclarator(namespace)
  }, null, state);

  Object.keys(state.modules).forEach(function(key){
    graph.addNode(key);
    state.modules[key].src.forEach(function(dependency){
      graph.addNode(dependency);
      graph.addDependency(key, dependency);
    });
  });

  callback(null, graph);
}
module.exports.insertFromBundle = insertFromBundle;

function emptyGraph() {
  return new dependencyGraph.DepGraph();
}
module.exports.emptyGraph = emptyGraph;
