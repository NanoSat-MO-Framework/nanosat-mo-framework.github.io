
/* Download Form Validation */
$(function() {

  $("#downloadForm input,#downloadForm textarea").jqBootstrapValidation({
    preventSubmit: true,
    submitError: function($form, event, errors) {
      // additional error messages or events
    },
    submitSuccess: function($form, event) {
      event.preventDefault(); // prevent default submit behaviour
      // get values from FORM
      var name = $("input#name_download").val();
      var email = $("input#email_download").val();
      var firstName = name; // For Success/Failure Message
      // Check for white space in name for Success/Fail message
      if (firstName.indexOf(' ') >= 0) {
        firstName = name.split(' ').slice(0, -1).join(' ');
      }
      $this = $("#downloadButton");
      $this.prop("disabled", true); // Disable submit button until AJAX call is complete to prevent duplicate messages
      $.ajax({
        url: "././mail/downloadLater.php",
        type: "POST",
        data: {
          name: name,
          email: email
        },
        cache: false,
        success: function() {
          // Success message
          $('#successDownload').html("<div class='alert alert-success'>");
          $('#successDownload > .alert-success').html("<button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;")
            .append("</button>");
          $('#successDownload > .alert-success')
            .append("<strong>Your message has been sent. </strong>");
          $('#successDownload > .alert-success')
            .append('</div>');
          //clear all fields
          $('#downloadForm').trigger("reset");
        },
        error: function() {
          // Fail message
          $('#successDownload').html("<div class='alert alert-danger'>");
          $('#successDownload > .alert-danger').html("<button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;")
            .append("</button>");
          $('#successDownload > .alert-danger').append($("<strong>").text("Sorry " + firstName + ", it seems that my mail server is not responding. Please try again later!"));
          $('#successDownload > .alert-danger').append('</div>');
          //clear all fields
          $('#downloadForm').trigger("reset");
        },
        complete: function() {
          setTimeout(function() {
            $this.prop("disabled", false); // Re-enable submit button when AJAX call is complete
          }, 1000);
        }
      });
    },
    filter: function() {
      return $(this).is(":visible");
    },
  });
  
/*When clicking on Full hide fail/success boxes */
$('#name').focus(function() {
  $('#successDownload').html('');
});
  

  $("a[data-toggle=\"tab\"]").click(function(e) {
    e.preventDefault();
    $(this).tab("show");
  });
});

/* Pre-order Form Validation */
$(function() {

  $("#preorderForm input,#preorderForm textarea").jqBootstrapValidation({
    preventSubmit: true,
    submitError: function($form, event, errors) {
      // additional error messages or events
    },
    submitSuccess: function($form, event) {
      event.preventDefault(); // prevent default submit behaviour
      // get values from FORM
      var name_preorder = $("input#name_preorder").val();
      var email_preorder = $("input#email_preorder").val();
      var phone_preorder = $("input#phone_preorder").val();
      var school = $("input#school").val();
      var package_preorder = $("input#package_preorder").val();
	  
      var streetaddress1 = $("input#streetaddress1").val();
      var streetaddress2 = $("input#streetaddress2").val();
      var city = $("input#city").val();
      var state = $("input#state").val();
      var postalcode = $("input#postalcode").val();
      var country = $("input#country").val();

      var firstName = name; // For Success/Failure Message
      // Check for white space in name for Success/Fail message
      if (firstName.indexOf(' ') >= 0) {
        firstName = name.split(' ').slice(0, -1).join(' ');
      }
      $this = $("#preorderButton");
      $this.prop("disabled", true); // Disable submit button until AJAX call is complete to prevent duplicate messages
      $.ajax({
        url: "././mail/preorder.php",
        type: "POST",
        data: {
          name: name_preorder,
          email: email_preorder,
          phone: phone_preorder,
          school: school,
          package_preorder: package_preorder,
          streetaddress1: streetaddress1,
          streetaddress2: streetaddress2,
          city: city,
          state: state,
          postalcode: postalcode,
          country: country
        },
        cache: false,
        success: function() {
          // Success message
          $('#successPreorder').html("<div class='alert alert-success'>");
          $('#successPreorder > .alert-success').html("<button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;")
            .append("</button>");
          $('#successPreorder > .alert-success')
            .append("<strong>Pre-order submitted!</strong>");
          $('#successPreorder > .alert-success')
            .append('</div>');
          //clear all fields
          $('#preorderForm').trigger("reset");
        },
        error: function() {
          // Fail message
          $('#successPreorder').html("<div class='alert alert-danger'>");
          $('#successPreorder > .alert-danger').html("<button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;")
            .append("</button>");
          $('#successPreorder > .alert-danger').append($("<strong>").text("Sorry " + firstName + ", it seems that my mail server is not responding. Please try again later!"));
          $('#successPreorder > .alert-danger').append('</div>');
          //clear all fields
          $('#preorderForm').trigger("reset");
        },
        complete: function() {
          setTimeout(function() {
            $this.prop("disabled", false); // Re-enable submit button when AJAX call is complete
          }, 1000);
        }
      });
    },
    filter: function() {
      return $(this).is(":visible");
    },
  });

  $("a[data-toggle=\"tab\"]").click(function(e) {
    e.preventDefault();
    $(this).tab("show");
  });
});

/*When clicking on Full hide fail/success boxes */
$('#name').focus(function() {
  $('#successPreorder').html('');
});



