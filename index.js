$(document).ready(function () {
    var newImage;
    var filter = [];
    var selectedFilters;
    $("#mybutton").click(function () {
        $(".pop-container").fadeIn();
    });
    $(".close-popup1").click(function () {
        $(".pop-container").fadeOut();
    })
    $("#file").change(function () {
        var fileInput = this;
        if (fileInput.files && fileInput.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var imageSrc = e.target.result;
                newImage = $("<img>").attr("src", imageSrc).attr("alt", "loading...");
            };
            reader.readAsDataURL(fileInput.files[0]);
        }
    });
    function filterJobListings() {
        // Reset the filter array
        
        selectedFilters = filter;
    
        // Hide all job listings
        $('.main').hide();
    
        $('.main').each(function () {
            var jobListing = $(this);
            var jobListingText = jobListing.find('.main_second #third').text();
    
            // Check if the job listing text contains all selected filters
            var shouldShow = selectedFilters.every(function (filterText) {
                return jobListingText.includes(filterText);
            });
    
            if (shouldShow) {
                jobListing.show();
            }
        });
    }
    

    $(document).on('click', '.close-popup2', function () {
        var name = $(this).prev('p').text();
        var index = filter.indexOf(name);
        
        if (index !== -1) {
            filter.splice(index, 1); 
            $(this).closest('#filter').remove();
            
            filterJobListings();
        }
    });
    $(document).on('click', '.delete-job', function () {
        $(this).closest('.main').remove(); // Remove the job element
    
        // Check if there are no more job elements left
        if ($('.main').length === 0) {
            resetFilters(); // Call the resetFilters function when there are no jobs left
        }
    });

    function resetFilters() {
        filter = [];
        $(".filter #filter").remove(); 
        $('.main').show();
    }

    $('#clear-button a').click(function (e) {
        e.preventDefault();
        resetFilters();
    });

    $(document).on('click', '#role p, #level p, #language p, #tool p', function () {
        var name = $(this).text();
        if (filter.indexOf(name) === -1) {
            filter.push(name);
    
            var newDiv = $("<div>").attr('id', 'filter');
            var para = $("<p>").text(name);
            var span = $("<span>").addClass("close-popup2").text("×");
            newDiv.append(para, span);
            $(".filter").append(newDiv);
    
            filterJobListings();
        }
    });
    $(document).on("click", ".details", function () {
        // $(".popup-container").show();
        var image = $(this).closest(".main").find("#first").html();
        var companyName = $(this).closest(".main").find('#user_name p').text();
        var companyRole = $(this).closest(".main").find('#user_level strong').text();
        var postedTime = $(this).closest(".main").find('.user_time #user_time p').text();
        var location = $(this).closest(".main").find('.user_time #user_location p').text();
        var jobTime = $(this).closest(".main").find('.user_time #user_contract p').text();
        var role = $(this).closest(".main").find('#role p').text();
        var level = $(this).closest(".main").find('#level p').text();
        var languages = $(this).closest(".main").find('#language p').map(function () {
            return $(this).text();
        }).get().join(', ');
        var tools = $(this).closest(".main").find('#tool p').map(function () {
            return $(this).text();
        }).get().join(', ');
        $('#newfirst').html(image);
        $('#popup-company-name').text(companyName);
        $('#popup-company-role').text('Position: ' + companyRole);
        $('#popup-posted-time').text('Job Posted ' + postedTime);
        $('#popup-location').text('Location: ' + location);
        $('#popup-job-time').text('Contract: ' + jobTime);
        $('#popupRole').text('Role: ' + role);
        $('#popupLevel').text('Level: ' + level);
        $('#popupLanguages').text('Languages: ' + languages);
        $('#popupTools').text('Tools: ' + tools);

        // Show the popup
        $('.popup-container').fadeIn();
    });

    // Close the popup when clicking the close button
    $('.close-popup').click(function () {
        $('.popup-container').fadeOut();
    });

    $(".submit-button").click(function (event) {
        event.preventDefault();
        var companyName = $("#companyName").val();

        if (companyName.trim() === "") {
            alert("Company name is required.");
            return;
        }
        var companyRole = $("#companyRole").val();
        if (companyRole.trim() === "") {
            alert("Company role is required.");
            return;
        }
        var postedTime = $("#postedTime").val();
        var location = $("#location").val();
        var role = $("#Role").val();
        var level = $("#Level").val();
        var jobTime = $("#jobTime").val();
        var languages = [];
        $('input[name="languages[]"]:checked').each(function () {
            languages.push($(this).val());
        });
        if (languages.length === 0) {
            alert("Select at least one language.");
            return;
        }
        var tools = [];
        $('input[name="tools[]"]:checked').each(function () {
            tools.push($(this).val());
        });
        if (tools.length === 0) {
            alert("Select at least one tool.");
            return;
        }
        var newDiv = $("<div>").addClass("main");
        var mainFirstDiv = $("<div>").addClass("main_first");
        var mainSecondDiv = $("<div>").addClass("main_second");
        if (!newImage) {
            newImage = $("<img>").attr("src", "").attr("alt", "loading...");
        }
        mainFirstDiv.append($("<div>").attr("id", "first").html(newImage));

        // mainFirstDiv.append($("<div>").attr("id", "first").html('<img src="./images/photosnap.svg" alt="loading...">'));
        var secondDiv = $("<div>").attr("id", "second");
        secondDiv.append($("<div>").attr("id", "user_name").css("font-size", "15px").html("<p>" + companyName + "</p>"));
        secondDiv.append($("<div>").attr("id", "user_level").html("<p><strong>" + companyRole + "</strong></p>"));
        secondDiv.append($("<div>").attr("id", "third"));
        secondDiv.append($("<div>").addClass("user_time").append($("<div>").attr('id', "user_time").html("<p>" + postedTime + "</p>")));
        secondDiv.find(".user_time").append($("<div>").attr('id', "user_contract").html("<p>" + jobTime + "</p>"));
        secondDiv.find(".user_time").append($("<div>").attr('id', "user_location").html("<p>" + location + "</p>"));
        mainFirstDiv.append(secondDiv);
        newDiv.append(mainFirstDiv);

        mainSecondDiv.append($("<div>").attr("id", "third"));
        mainSecondDiv.find("#third").append($("<div>").attr("id", "role").html("<p>" + role + "</p>"));
        mainSecondDiv.find("#third").append($("<div>").attr("id", "level").html("<p>" + level + "</p>"));

        $.each(languages, function (index) {
            mainSecondDiv.find('#third').append($('<div>').attr('id', 'language').html('<p>' + languages[index] + '</p>'));
        });
        $.each(tools, function (index) {
            mainSecondDiv.find('#third').append($('<div>').attr('id', 'tool').html('<p>' + tools[index] + '</p>'));
        });

        newDiv.append(mainSecondDiv);

        var deleteButtonDiv = $("<div>").addClass("delete-button");
        var deleteButton = $("<button>").addClass("delete-job").text("Delete");

        deleteButtonDiv.append(deleteButton);
        newDiv.append(deleteButtonDiv);

        var detailButton = $("<button>").addClass("details").text("Detail");

        newDiv.find(".delete-button").append(detailButton);

        $("#job-listings").append(newDiv);
        $(".pop-container").fadeOut();
        $("#pop-form")[0].reset();
        filterJobListings();
        alert("Job Added Successfully");
        

    });



});
