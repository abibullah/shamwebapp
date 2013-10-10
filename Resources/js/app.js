// This Initializer sets the code to use crossdomain calls for the servers. :)
AjaxObj = {
          crossDomain: true,
          contentType: "application/json; charset=UTF-8",
          beforeSend: function( xhr, settings ) {
            settings.url = "http://"+ App.serverUrl + settings.url + '.json'
          }
        }

// Create Ember App
App = Ember.Application.create({})

// App variable setups
App.serverUrl = null
App.user = {}

// App Related Directory Setup
App.appDirectory = Ti.Filesystem.getApplicationDirectory().nativePath().toString()
App.userDirectory = Ti.Filesystem.getUserDirectory()
App.unix = Ti.getPlatform() !=  'win32'
App.shamisenDirectory = (App.unix ? App.userDirectory : "C:/") + "/shamisen"
App.shamisenTmpDirectory = App.shamisenDirectory+ "/tmp"
App.shamisenAppsDirectory = App.shamisenTmpDirectory + "/apps"

Ember.Application.initializer({
  name: "initialShmisenApps",

  initialize: function(container, application) {
    var shamisen_tmp_dir = Ti.Filesystem.getFile(App.shamisenTmpDirectory);
    if(!shamisen_tmp_dir.isDirectory())
      shamisen_tmp_dir.createDirectory()
    // This Order is Importent: As tmp creation will come before the apps
    var shamisen_apps_dir = Ti.Filesystem.getFile(App.shamisenAppsDirectory);
    if(!shamisen_apps_dir.isDirectory())
      shamisen_apps_dir.createDirectory();
  }
});

Ember.Application.initializer({
  name: "initialAjaxSetup",

  initialize: function(container, application) {
    $.ajaxSetup(AjaxObj);
  }
});

Ember.Application.initializer({
  name: "loadUserState",

  initialize: function(container, application) {
    var readfi = Ti.Filesystem.getFile(App.appDirectory +'/userinfo.yml');
    if(readfi.exists()){
      var Stream = Ti.Filesystem.getFileStream(readfi);    
      Stream.open(Ti.Filesystem.MODE_READ);
      var contents = Stream.read();
      app_json = jsyaml.load(contents.toString())
      App.serverUrl = app_json.server
      if(app_json.access_token != null){
        $.ajax({
            type: "POST",
            async: false,
            dataType: 'json',
            url: "/login",
            headers: {'CUSTOMER-LOGIN-KEY': app_json.access_token},
            data: JSON.stringify({dummy: 'dummy'})
        }).done(function(data){
          // This sets the setup for the further Coding
          Ember.set('App.user', data.user)
          AjaxObj.headers = {'CUSTOMER-LOGIN-KEY': app_json.access_token}
          $.ajaxSetup(AjaxObj)
        })
      }
      Stream.close()
    }
    else{
      alert("Looks like this is your first time. :)")
    }
  }
});


// Ember Related App Initialization
App.Store = DS.Store.extend({});

App.ApplicationController = Ember.Controller.extend({
  userNotLogged: function(){
    return $.isEmptyObject(App.user)
  }.property('App.user'),
  resetAjaxSetup: function(access_token){
    AjaxObj.headers = {'CUSTOMER-LOGIN-KEY': access_token}
    $.ajaxSetup(AjaxObj)
  },
  actions: {
    logout: function(){
        Ember.set('App.user', {})
        this.resetAjaxSetup(null)
    }
  }
})

App.BaseObjectController = Ember.ObjectController.extend({
  userNotLogged: function(){
    return $.isEmptyObject(App.user)
  }.property('App.user')

});

App.BaseArrayController = Ember.ArrayController.extend({
  userNotLogged: function(){
    return $.isEmptyObject(App.user)
  }.property('App.user')
})

App.MobileAppVersion = DS.Model.extend({
  version: DS.attr('string'),
  category: DS.attr('string'),
  app_file_name: DS.attr('string'),
  mobile_app_id: DS.attr(),
  description: DS.attr(),
  project_id: DS.attr()
});

App.Router.map(function () {
  this.route('home', {path: '/' });
  this.resource('mobile_app_versions', {path: '/mobile_app_versions'}, function(){
    this.route('new')
  })    
});

// Routes
App.MobileAppVersionsIndexRoute = Ember.Route.extend({
  userNotLogged: function(){
    return $.isEmptyObject(App.user)
  }.property('App.user'),
  setupController: function(controller){
    if(!this.get('userNotLogged'))
    controller.set('model', this.store.find('mobile_app_version'))
  }
})
App.MobileAppVersionsNewRoute = Ember.Route.extend({
  model: function(){
    return this.store.createRecord('mobile_app_version', {version: "v1"})
  },
  setupController: function(controller, model) {
    controller.set("model", model);
    model.set("category", "iOS")
  }
})

// Controllers
App.MobileAppVersionsIndexController = App.BaseArrayController.extend({
  actions: {
      deleteVersion: function(model){
        var self = this;
        model.deleteRecord();
        model.save();
      }
  }
})

App.MobileAppVersionsNewController = App.BaseObjectController.extend({
  selectedCompany: null,
  selectedProject: null,
  selectedFile: null,
  fileStatus: null,
  user_companies: function(){
    if (App.user == null)
      return []
    else
      return _.map(App.user.authorized_companies, function(co){return {name: co.name, id: co.id}});
  }.property('App.user'),
  companyProjects: function(){
    if(this.get('selectedCompany') != null){
       this.set('selectedProject', null)
       return _.where(App.user.authorized_projects, {id: this.get('selectedCompany').id})[0].projects
    }
    else 
      return null
  }.property('selectedCompany'),
  mobileCategories: [{name: "iOS", value: "iOS"},
                    {name: "Android", value: "Android"}],
  actions: {
      openFileSelection: function(){
        var self = this;
        var process = Ti.Process.createProcess(
            ['ls -la']
        );
        process.launch();
        var callbackFunc = function(filenames){  
            fileSelected = filenames[0];
            self.set('selectedFile',fileSelected)
        };
        var options = {
           multiple: false,  
           title: "Select files to open...",  
           types: ['zip'],  
           typesDescription: "Documents",  
           path: App.userDirectory  
        };
        Ti.UI.openFileChooserDialog(callbackFunc, options);
      },
      SavemAppUpload: function(model){
        if(this.selectedProject != null && this.get('selectedFile') != null){
          var self = this;
          model.set('project_id', this.selectedProject.id)
          model.save().then(function(app){
            if (app.id != null){
              app_version_folder = Ti.Filesystem.getFile(App.shamisenAppsDirectory+"/"+app.id);
              app_version_folder.createDirectory();
              app_file = Ti.Filesystem.getFile(self.get('selectedFile'))
              self.set('fileStatus', "File Is Getting Copied to the shamisen tmp folder")
              // Unzip the ZIP file to the Destination
              app_file.unzip(app_version_folder)
              self.set("selectedFile", null)
              self.set("fileStatus", "File Copied Completely. :)")
              self.transitionToRoute("mobile_app_versions")
            }
            else{
              alert("Please check all the information")
            }
          })
        }
        else {
          alert("Please check all the information, project")
        }
      }
    }
})

App.HomeRoute = Ember.Route.extend({
  setupController: function(controller){
    controller.set('content', App.user)
  }
})

App.HomeController =  App.BaseObjectController.extend({
    resetAjaxSetup: function(access_token){
      AjaxObj.headers = {'CUSTOMER-LOGIN-KEY': access_token}
      $.ajaxSetup(AjaxObj)
    },
    actions: {
      submit: function() {
          var controller = this
          App.set('serverUrl', $("#inputserver").val())
          if(App.serverUrl == "")
              alert("Please enter the server from which to authenticate.")
          $.ajax({
              type: "POST",
              async: true,
              dataType: 'json',
              url: "/login",
              data: JSON.stringify($('#sign-in-form').serializeObject())
          }).done(function(data){
              // This sets the setup for the further Coding
              controller.set('content', data.user)
              Ember.set('App.user', data.user)
              controller.resetAjaxSetup(data.user.single_access_token)
              controller.transitionToRoute('home')
              var doc = Ti.Filesystem.getFile(App.appDirectory +'/userinfo.yml');
              doc.open(Ti.Filesystem.MODE_WRITE);
              // This Will Write Settings YML
              doc.write(jsyaml.dump({
                server: App.serverUrl,
                access_token: data.user.single_access_token
              }));
          })
      },
      saveShamisen: function(){
        var readfi = Ti.Filesystem.getFile(App.shamisenDirectory+'/config/settings.yml');
        shamisen_name = $('#inputshamisenname').val().replace(/\s+/g, '')
        if (readfi.exists() && ($('#inputshamisenname').val().replace(/\s+/g, '') != "") && shamisen_name.length > 8)
        {  
          var Stream = Ti.Filesystem.getFileStream(readfi);    
          Stream.open(Ti.Filesystem.MODE_READ);  
          var contents = Stream.read();
          App.serverUrl = $("#inputserver").val()
          settings_json = jsyaml.load(contents.toString())
          settings_json.awetest_server.hostname = App.serverUrl
          settings_json.shamisen_name = $('#inputshamisenname').val()
          Stream.close();    
          var document1 = Ti.Filesystem.getFile(App.shamisenDirectory+'/config/settings_generated.yml');
          document1.open(Ti.Filesystem.MODE_WRITE);
          document1.write(jsyaml.dump(settings_json));
          document1.close();
        }
        else{
          alert("Either your settings yaml is missing at "+ App.shamisenDirectory
            +'/config/settings.yml'+ " OR Enter the Shmisen Name Properly, with minimu 8 charectors")
        }
      },
      logout: function(){
          Ember.set('App.user', {})
          this.resetAjaxSetup(null)
          var doc = Ti.Filesystem.getFile(App.appDirectory +'/userinfo.yml');
          doc.open(Ti.Filesystem.MODE_WRITE);
          // This Will Write Settings YML
          doc.write(jsyaml.dump({
            server: App.serverUrl,
            access_token: null
          }));
      }
    }
});
