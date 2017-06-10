var _ = require("lodash");
var async=require("async");

module.exports=function(module){

  var apos = module.apos;
  var manager = module.apos.docs.getManager('localizedDocument');

  function isArea(value) {
    return !((!value) || (value.type !== 'area'));
  }

  function isUniversal(doc, key) {

    if(!module.options.universal){
      return false;
    }

    if (module.options.universal.indexOf(key) >=0 || module.options.universal.indexOf( doc.type + ':' + key) >= 0) {
      return true;
    }

  }

  function localizedKeyForDoc(doc,name){

    var matches = name.match(/([\w-]+):(\w+)/);

    if (matches) {
      if (doc.type !== matches[1]) {
        return;
      }
      name = matches[2];
    }
    if (!_.has(doc, name)) {
      return;
    }


    return name;

  }


  function isNeverType(doc){

    if(!doc.type){
      return false;
    }


    if(!module.neverTypes){
      return false;
    }


    return module.neverTypes.indexOf(doc.type) >=0;

  }


  function setup(req,doc,locales,callback){



    var docs = {};


    async.each(Object.keys(locales),function(locale,callback){

      if(docs[locale]){
        return callback();
      }

      async.series({
        find:function (callback) {

          manager.find(req,{
            "locale":locale,
            "docId":doc._id
          }).limit(1)
            .areas(false)
            .toObject(function(err,doc){
              if(err){
                return callback(err);
              }

              docs[locale] = doc;
              return callback();
            })
        },
        create:function(callback){

          if(docs[locale]) {
            return callback();
          }

          var l = manager.newInstance();
          l.locale = locale;
          l.slug = "localized-"+doc._id;
          l.docId = doc._id;
          l.doc = {};
          l.docPermissions = doc.docPermissions;

          manager.insert(req,l,{permissions:false},function(err,doc){

            if(err){
              console.log("Error inserting document ",doc);
              return callback(err);
            }


            docs[locale]=doc[2];

            return callback();
          });

        }
      },callback);
    },function(err){

      if(err){
        return callback(err);
      }
      return callback(null,{"docs":docs});

    });

  }




  function debugDocument(doc,title,matcher){



    if(matcher(doc)){
      console.log("\n\n***************** ", title ,"***************** \n\n");


      console.log("Id: ",doc._id);
      _.each(doc,function(value,key){
        console.log("\tKey: ",key);
        console.log("\tValue",JSON.stringify(value,null,2));
        console.log("");
        console.log("");
        console.log("");

      });
    console.log("************************************************************* \n\n");
    }

  }
  return {

    syncLocale:function(req,doc,locale,callback){

      if(isNeverType(doc)){

        console.log("Doc type ",doc.type, " is in neverTypes");
        return callback();

      }


      var localized= {};


      async.series({

        setup:function(callback){

          setup(req,doc,module.locales,function(err,setup){
            if(err){
              return callback(err);
            }

            localized = setup;
            return callback()
          });
        },
        populateFields:function(callback){

          _.each(doc, function(value, key) {

            if(key === "_id"){
              return;
            }

            if (!isArea(value)) {
              return;
            }

            if (isUniversal(doc, key)) {
              return;
            }


            localized.docs[locale].doc[key] = value;


            // Revert .body to the default culture's body, unless
            // that doesn't exist yet, in which case we let it spawn from
            // the current culture
            if (_.has(localized.docs[module.defaultLocale].doc, key)) {
              doc[key] = localized.docs[module.defaultLocale].doc[key];
            } else {
              localized.docs[module.defaultLocale].doc[key]=doc[key];
            }

          });


          _.each(module.localized,function(name){
            name = localizedKeyForDoc(doc,name);

            if(!name){
              return;
            }

            if(isArea(doc[name])){
              return;
            }

            localized.docs[locale].doc[name]=doc[name];



            if (_.has(localized.docs[module.defaultLocale].doc, name)) {
              doc[name] = localized.docs[module.defaultLocale].doc[name];
            } else {
              localized.docs[module.defaultLocale].doc[name] = doc[name];
            }

          });



          callback();

        },
        saveDos:function(callback){

          var l = [module.defaultLocale,locale];
          async.each(l,function(locale,callback){
            return apos.localized.update({_id:localized.docs[locale]._id},localized.docs[locale],{permissions:false},callback);
          },callback)

        }
      },callback);

    },
    loadLocale:function(req,results,locale,callback){

      async.each(results,function(doc,callback){

        if(isNeverType(doc)){
          return callback();

        }

        return setup(req,doc,module.locales,function(err,localized){

          if(err){
            console.log('Error ',err,'calling callback');
            return callback(err);
          }

          _.each(doc, function (value, key) {

            if (!isArea(value)) {
              return;
            }

            if (isUniversal(doc, key)) {
              return;
            }

            // for bc with sites that didn't have this module until
            // this moment, if the default locale has no content,
            // populate it from the live property


            if (!_.has(localized.docs[module.defaultLocale].doc, key)) {
              localized.docs[module.defaultLocale].doc[key] = doc[key];
            }


            if (!_.has(localized.docs[locale].doc, key)) {
              return;
            }




            doc[key] = _.clone(localized.docs[locale].doc[key]);


            /**
             *
             * Here is the deal. Once we decided that we are going to separate localization
             * to a different document type so that _pieces, et al are loaded by the .areas
             * filter.
             *
             * This however causes an issues there the _docId and the _dotPath are correctly
             * set to that of the existanze-localized-piece, however since the internationalization
             * logic is to override values from the original document, then we just do that
             * here.
             */
            if(doc[key]["_docId"]){
              doc[key]["_docId"]=doc._id;
            }

            if(doc[key]["_dotPath"]){
              doc[key]["_dotPath"]=key;
            }

          });

          _.each(module.localized, function (name) {


            name = localizedKeyForDoc(doc, name);

            if (!name) {
              return;
            }


            // for bc with sites that didn't have this module until
            // this moment, if the default locale has no content,
            // populate it from the live property
            if (!_.has(localized.docs[module.defaultLocale].doc, name)) {
              localized.docs[module.defaultLocale].doc[name] = doc[name];
            }

            if (!_.has(localized.docs[locale].doc, name)) {
              return;
            }

            doc[name] = localized.docs[locale].doc[name];


          });





          return callback();

        });

      },function(err){

        callback(err,results);

      });

    },
    migrateLocale:function(doc,callback){


      if(!doc.localized){
        console.log("No localized in ",doc._id,doc.type);
        return callback();
      }

      var req = apos.tasks.getReq();
      var _locales = Object.keys(doc.localized);

      async.each(_locales,function(locale,callback){

        if(!doc.localized[locale]){return callback()}

        var localized  = {};

        async.series({
          setup:function(callback){
            setup(req,doc,module.locales,function(err,setup){

              if(err){return callback(err)}
              localized=setup;
              return callback();
            });
          },
          clone:function(callback){
            _.each(doc.localized[locale], function(value, key) {


              if(isUniversal(doc,key)){
                console.log("Key: ", key, " is universal not adding ");
                return;
              }

              localized.docs[locale][key] = value;
              //remove never times

            });

            return callback();
          },
          save:function(callback){
            return localized.collection.update({_id:localized.docs[locale]._id},localized.docs[locale],callback);
          }
        },callback);
      },function(err){

        if(err){
          return callback(err);
        }

        delete doc.localized;
        delete doc.localizedAt;
        delete doc.localizedStale;
        delete doc.localizedSeen;

        return callback();

      });

    },
    migrateToDocument:function(req,doc,callback){


      var l = manager.newInstance();
      doc = apos.utils.clonePermanent(doc);

      l.locale= doc.locale;
      l.docId = doc.docId;

      l.slug = "localized-"+doc.docId;

      delete doc._id;
      delete doc.docId;
      delete doc.type;
      delete doc.locale;

      l.doc = doc;
      manager.insert(req,l,callback);

    }
  }




};