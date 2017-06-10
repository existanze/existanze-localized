var _ = require('lodash');
var async =require('async');

module.exports = function (module,localized) {

  return {

    construct: function (self, options) {


      self.localize=function(results,callback){
        var req = self.get('req');

        if (!req.locale) {
          return callback(null,results);
        }

        var locale = req.session.locale ? req.session.locale : module.defaultLocale;

        if (!locale) {
          locale = req.locale;
        }

        if(module.disableLoad){
          return callback(null,results);
        }

        return localized.loadLocale(req,results,locale,callback);

      };

      self.toArray = function(callback) {
        return async.waterfall([
          self.toMongo,
          self.mongoToArray,
          self.localize,
          self.after
        ], callback);
      };


    }
  }

};
