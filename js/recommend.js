$(function() {

  $("#forwardForm input,#forwardForm textarea").jqBootstrapValidation({
    preventSubmit: true,
    submitError: function($form, event, errors) {
      // additional error messages or events
    },
    submitSuccess: function($form, event) {
      event.preventDefault(); // prevent default submit behaviour
      // get values from FORM
      var senderName = $("input#senderName").val();
      var name = $("input#name").val();
      var email = $("input#email").val();
      var firstName = senderName; // For Success/Failure Message
      // Check for white space in name for Success/Fail message
      if (firstName.indexOf(' ') >= 0) {
        firstName = name.split(' ').slice(0, -1).join(' ');
      }
      $this = $("#sendMessageButton");
      $this.prop("disabled", true); // Disable submit button until AJAX call is complete to prevent duplicate messages
      $.ajax({
        url: "././mail/forward.php",
        type: "POST",
        data: {
          senderName: senderName,
          name: name,
          email: email
        },
        cache: false,
        success: function() {
          // Success message
          $('#successForward').html("<div class='alert alert-success'>");
          $('#successForward > .alert-success').html("<button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;")
            .append("</button>");
          $('#successForward > .alert-success')
            .append("<strong>Your message has been sent. </strong>");
          $('#successForward > .alert-success')
            .append('</div>');
          //clear all fields
          $('#forwardForm').trigger("reset");
        },
        error: function() {
          // Fail message
          $('#successForward').html("<div class='alert alert-danger'>");
          $('#successForward > .alert-danger').html("<button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;")
            .append("</button>");
          $('#successForward > .alert-danger').append($("<strong>").text("Sorry " + firstName + ", it seems that my mail server is not responding. Please try again later!"));
          $('#successForward > .alert-danger').append('</div>');
          //clear all fields
          $('#forwardForm').trigger("reset");
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
  $('#successForward').html('');
});

