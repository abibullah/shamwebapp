// var menu = Ti.UI.createMenu(),
// fileItem = Ti.UI.createMenuItem('File'),
// exitItem = fileItem.addItem('Exit', function() {
//   if (confirm('Are you sure you want to quit?')) {
//     Ti.App.exit();
//   }
// });

// menu.appendItem(fileItem);
// Ti.UI.setMenu(menu);


ShamisenWebApp = Ember.Application.create();

ShamisenWebApp.Router.map(function () {
  this.resource('home', {path: '/' });
});

$(document).ready(function(){
	$('#sign-in-form').validate({
	    rules: {
	        username: {
	            minlength: 3,
	            maxlength: 15,
	            required: true,
	            lettersonly: true
	        },
	        password: {
	            minlength: 3,
	            maxlength: 15,
	            required: true,
	            lettersonly: true
	        },
	    },
	    highlight: function (element) {
	        $(element).closest('.control-group').addClass('has-error');
	    },
	    unhighlight: function (element) {
	        $(element).closest('.control-group').removeClass('has-error');
	    },
		  submitHandler: function(form) {
		  	$.ajax({
		  		type: "POST",
		  		dataType: 'JSONP',
		  		url: "http://localhost:3000/login?callback=?",
		  		data: $(form).serialize(),
		  		success: function(data){
		  			alert("SUCCESS")
		  		}
		  	})
		  }    
	});
})