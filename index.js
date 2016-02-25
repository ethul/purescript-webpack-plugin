'use strict';

var path = require('path');

var fs = require('fs');

var child_process = require('child_process');

var dependencyGraph = require('./dependency-graph');

var dependencyMap = require('./dependency-map');

var moduleParser = require('./module-parser');

var PSC = 'psc';

var PSC_BUNDLE = 'psc-bundle';

var REQUIRE_PATH = '../';

var PURS = '.purs';

function PurescriptWebpackPlugin(options) {
  this.options = Object.assign({
    src: [
      path.join('src', '**', '*.purs'),
      path.join('bower_components', 'purescript-*', 'src', '**', '*.purs')
    ],
    ffi: [
      path.join('src', '**', '*.js'),
      path.join('bower_components', 'purescript-*', 'src', '**', '*.js')
    ],
    output: 'output',
    bundleOutput: path.join('output', 'bundle.js'),
    bundleNamespace: 'PS'
  }, options);

  this.context = {};

  this.dependencySrcMap = dependencyMap.emptyMap();

  this.dependencyFFIMap = dependencyMap.emptyMap();

  this.dependencyGraph = dependencyGraph.emptyGraph();
}

PurescriptWebpackPlugin.prototype.bundleModuleNames = function(){
  var entries = this.context.bundleEntries;

  var modules = this.context.compilation.modules;

  var moduleNames = entries.map(function(entry){
    var module_ = modules.filter(function(module_){
      return module_.userRequest === entry.userRequest;
    });

    if (!module_[0]) return null;
    else {
      var file = module_[0].resource;

      var result = moduleParser.srcNameSync(file);

      return result;
    }
  });

  var nonNullNames = moduleNames.filter(function(name){ return name !== null; });

  return nonNullNames;
};

PurescriptWebpackPlugin.prototype.bundle = function(callback){
  var moduleNames = this.bundleModuleNames();

  if (moduleNames.length === 0) callback(new Error("No entry point module names found."), null);
  else {
    var moduleArgs = moduleNames.reduce(function(b, a){ return b.concat(['-m', a]); }, []);

    var args = moduleArgs.concat([
      '-n', this.options.bundleNamespace,
      '-r', REQUIRE_PATH,
      path.join(this.options.output, '**', 'index.js'),
      path.join(this.options.output, '**', 'foreign.js')
    ]);

    var psc = child_process.spawn(PSC_BUNDLE, args);

    var stdout = '';

    var stderr = '';

    psc.stdout.on('data', function(data){
      stdout = stdout + data.toString();
    });

    psc.stderr.on('data', function(data){
      stderr = stderr + data.toString();
    });

    psc.on('close', function(code){
      var error = code !== 0 ? new Error(stderr) : null;
      callback(error, stdout);
    });
  }
};

PurescriptWebpackPlugin.prototype.compile = function(callback){
  var ffiArgs = this.options.ffi.reduce(function(b, a){ return b.concat(['-f', a]); }, []);

  var args = ffiArgs.concat([
    '-o', this.options.output,
    '-r', REQUIRE_PATH
  ]).concat(this.options.src);

  var psc = child_process.spawn(PSC, args);

  var stderr = '';

  psc.stderr.on('data', function(data){
    stderr = stderr + data.toString();
  });

  psc.on('close', function(code){
    var error = code !== 0 ? new Error(stderr) : null;
    callback(error);
  });
};

PurescriptWebpackPlugin.prototype.updateDependencies = function(bundle, callback){
  var plugin = this;

  dependencyMap.insertSrcGlobs(plugin.options.src, dependencyMap.emptyMap(), function(error, srcMap){
    if (error) callback(error);
    else {
      dependencyMap.insertFFIGlobs(plugin.options.ffi, dependencyMap.emptyMap(), function(error, ffiMap){
        if (error) callback(error);
        else {
          dependencyGraph.insertFromBundle(bundle, plugin.options.bundleNamespace, dependencyGraph.emptyGraph(), function(error, graph){
            if (error) callback(error);
            else {
              var dependencies = {
                srcMap: srcMap,
                ffiMap: ffiMap,
                graph: graph
              };

              callback(null, dependencies);
            }
          });
        }
      });
    }
  });
};

PurescriptWebpackPlugin.prototype.apply = function(compiler){
  var plugin = this;

  function compile(options) {
    return function(callback){
      return function(){
        var callbacks = plugin.context.callbacks;

        callbacks.push(callback);

        if (plugin.context.requiresCompiling) {
          plugin.context.requiresCompiling = false;

          plugin.compile(function(error){
            var dependencies = {
              srcMap: plugin.dependencySrcMap,
              ffiMap: plugin.dependencyFFIMap,
              graph: plugin.dependencyGraph
            };

            if (error) callbacks.forEach(function(callback){callback(error)(dependencies)()});
            else {
              plugin.bundle(function(error, result){
                if (error) callbacks.forEach(function(callback){callback(error)(dependencies)()});
                else {
                  plugin.updateDependencies(result, function(error, dependencies_){
                    plugin.dependencySrcMap = dependencies_.srcMap;

                    plugin.dependencyFFIMap = dependencies_.ffiMap;

                    plugin.dependencyGraph = dependencies_.graph;

                    var result_ = result + 'module.exports = ' + plugin.options.bundleNamespace + ';';

                    fs.writeFile(plugin.options.bundleOutput, result_, function(error_){
                      callbacks.forEach(function(callback){
                        callback(error_ || error)(dependencies_)()
                      });
                    });
                  });
                }
              });
            }
          });
        }
      };
    };
  }

  compiler.plugin('compilation', function(compilation, params){
    Object.assign(plugin.context, {
      requiresCompiling: true,
      bundleEntries: [],
      callbacks: [],
      compilation: null,
      compile: compile(compilation.compiler.options)
    });

    compilation.plugin('normal-module-loader', function(loaderContext, module){
      if (path.extname(module.userRequest) === PURS) {
        plugin.context.compilation = compilation;
        loaderContext.purescriptWebpackPluginContext = plugin.context;
      }
    });
  });

  compiler.plugin('normal-module-factory', function(normalModuleFactory){
    normalModuleFactory.plugin('after-resolve', function(data, callback){
      if (path.extname(data.userRequest) === PURS) {
        plugin.context.bundleEntries.push(data);
      }
      callback(null, data);
    });
  });
};

module.exports = PurescriptWebpackPlugin;
