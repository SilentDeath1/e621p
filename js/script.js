/*
  Author: Yuval Greenfield (http://uberpython.wordpress.com)
  Modifier to E621P: SilentDeath1 (https://github.com/SilentDeath1/e621p)

  You can save the HTML file and use it locally btw like so:
    file:///wherever/index.html?tags=wolf

  Favicon by Double-J designs http://www.iconfinder.com/icondetails/68600/64/_icon
  HTML based on http://demo.marcofolio.net/fullscreen_image_slider/
  Author of slideshow base :      Marco Kuiper (http://www.marcofolio.net/)
*/

// TODO: refactor all the globals to use the ep object's namespace.
var ep = {};
ep.debug = true;

// Speed of the animation
var animationSpeed = 1000;
var shouldAutoNextSlide = true;
var timeToNextSlide = 6 * 1000;
var cookieDays = 300;

// These vars are used for AJAX Url.
var e621pTags = '';
var e621pLimit = 10;
var e621pPageNumber = 1;
var e621pRating = '';

var e621pDescending = true;
var e621pAfterId = 0;

// These variables are used to decide if there is more data from the API.
var e621pFailedImageNumber = 0;
var e621pSuccessImageNumber = 0;

// Variable to store the images we need to set as background
// which also includes some text and url's.
ep.photos = [];

// 0-based index to set which picture to show first
// init to -1 until the first image is loaded
var activeIndex = -1;


// IE doesn't have indexOf, wtf...
if (!Array.indexOf) {
    Array.prototype.indexOf = function (obj) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == obj) {
                return i;
            }
        }
        return -1;
    };
}

// IE doesn't have console.log and fails, wtf...
// usage: log('inside coolFunc',this,arguments);
// http://paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function () {
    log.history = log.history || []; // store logs to an array for reference
    log.history.push(arguments);
    if (this.console) {
        console.log(Array.prototype.slice.call(arguments));
    }
};

$(function () {

    $("#subredditUrl").text("Loading E621 Slideshow");
    $("#navboxTitle").text("Loading E621 Slideshow");

    //Get Query Variables From URL.

    if(getQueryVariable("tags")== '' /*|| (typeof getQueryVariable("tags")) != "string"*/){
			e621pTags = '';
      console.log('You can search specific tags by specifying ?tags= in the URL e.g. /?tags=wolf&page=1&limit=10');
		}else{
			e621pTags = getQueryVariable("tags");
		}

		if(getQueryVariable("page")== 0 /*|| (typeof getQueryVariable("page")) != "number"*/){
			e621pPageNumber = 1;
      console.log('You can select a specific page for results by specifying ?page= in the URL e.g. /?tags=wolf&page=1&limit=10');
		}else{
			e621pPageNumber = getQueryVariable("page");
		}

    if(getQueryVariable("limit")== 0 /*|| ((typeof getQueryVariable("limit")) != "number")*/){
			e621pLimit = 5;
      console.log('You can specify images per load cycle by specifying ?limit= in the URL e.g. /?tags=wolf&page=1&limit=10');
		}else{
			e621pLimit = getQueryVariable("limit");
		}

    fadeoutWhenIdle = true;
    var setupFadeoutOnIdle = function () {
        $('.fadeOnIdle').fadeTo('fast', 0);
        var navboxVisible = false;
        var fadeoutTimer = null;
        var fadeoutFunction = function () {
            navboxVisible = false;
            if (fadeoutWhenIdle) {
                $('.fadeOnIdle').fadeTo('slow', 0);
            }
        };
        $("body").mousemove(function () {
            if (navboxVisible) {
                clearTimeout(fadeoutTimer);
                fadeoutTimer = setTimeout(fadeoutFunction, 2000);
                return;
            }
            navboxVisible = true;
            $('.fadeOnIdle').fadeTo('fast', 1);
            fadeoutTimer = setTimeout(fadeoutFunction, 2000);
        });
    };
    // this fadeout was really inconvenient on mobile phones
    // and instead the minimize buttons should be used.
    //setupFadeoutOnIdle();

    var nextSlideTimeoutId = null;

    var loadingNextImages = false;

    function nextSlide() {
        if(!nsfw) {
            for(var i = activeIndex + 1; i < ep.photos.length; i++) {
                if (!ep.photos[i].over18) {
                    return startAnimation(i);
                }
            }
        }
        if (isLastImage(activeIndex) && !loadingNextImages) {
            // the only reason we got here and there aren't more pictures yet
            // is because there are no more images to load, start over
            return startAnimation(0);
        }
        startAnimation(activeIndex + 1);
    }
    function prevSlide() {
        if(!nsfw) {
            for(var i = activeIndex - 1; i > 0; i--) {
                if (!ep.photos[i].over18) {
                    return startAnimation(i);
                }
            }
        }
        startAnimation(activeIndex - 1);
    }


    var autoNextSlide = function () {
        if (shouldAutoNextSlide) {
            // startAnimation takes care of the setTimeout
            nextSlide();
        }
    };

    function getQueryVariable(variable) {
        const url = new URL(window.location)
        const value = url.searchParams.get(variable)
        return value || false
     }

    function open_in_background(selector){
        // as per https://developer.mozilla.org/en-US/docs/Web/API/event.initMouseEvent
        // works on latest chrome, safari and opera
        var link = $(selector)[0];

        // Simulating a ctrl key won't trigger a background tab on IE and Firefox ( https://bugzilla.mozilla.org/show_bug.cgi?id=812202 )
        // so we need to open a new window
        if ( navigator.userAgent.match(/msie/i) || navigator.userAgent.match(/trident/i)  || navigator.userAgent.match(/firefox/i) ){
            window.open(link.href,'_blank');
        } else {
            var mev = document.createEvent("MouseEvents");
            mev.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, true, false, false, true, 0, null);
            link.dispatchEvent(mev);
        }
    }

    $("#pictureSlider").touchwipe({
        // wipeLeft means the user moved his finger from right to left.
        wipeLeft: function () {
            nextSlide();
        },
        wipeRight: function () {
            prevSlide();
        },
        wipeUp: function () {
            nextSlide();
        },
        wipeDown: function () {
            prevSlide();
        },
        min_move_x: 20,
        min_move_y: 20,
        preventDefaultEvents: false
    });

    var OPENSTATE_ATTR = "data-openstate";
    $('.collapser').click(function () {
        var state = $(this).attr(OPENSTATE_ATTR);
        if (state == "open") {
            // close it
            $(this).text("+");
            // move to the left just enough so the collapser arrow is visible
            var arrowLeftPoint = $(this).position().left;
            $(this).parent().animate({
                left: "-" + arrowLeftPoint + "px"
            });
            $(this).attr(OPENSTATE_ATTR, "closed");
        } else {
            // open it
            $(this).text("-");
            $(this).parent().animate({
                left: "0px"
            });
            $(this).attr(OPENSTATE_ATTR, "open");
        }
    });

    // maybe checkout http://engineeredweb.com/blog/09/12/preloading-images-jquery-and-javascript/ for implementing the old precache
    var cache = [];
    // Arguments are image paths relative to the current page.
    var preLoadImages = function () {
        var args_len = arguments.length;
        for (var i = args_len; i--;) {
            var cacheImage = document.createElement('img');
            cacheImage.src = arguments[i];
            cache.push(cacheImage);
        }
    };

    var setCookie = function (c_name, value, exdays) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + exdays);
        var c_value = escape(value) + ((exdays === null) ? "" : "; expires=" + exdate.toUTCString());
        document.cookie = c_name + "=" + c_value;
    };

    var getCookie = function (c_name) {
        var i, x, y;
        var cookiesArray = document.cookie.split(";");
        for (i = 0; i < cookiesArray.length; i++) {
            x = cookiesArray[i].substr(0, cookiesArray[i].indexOf("="));
            y = cookiesArray[i].substr(cookiesArray[i].indexOf("=") + 1);
            x = x.replace(/^\s+|\s+$/g, "");
            if (x == c_name) {
                return unescape(y);
            }
        }
    };

    var resetNextSlideTimer = function () {
        clearTimeout(nextSlideTimeoutId);
        nextSlideTimeoutId = setTimeout(autoNextSlide, timeToNextSlide);
    };

    shouldAutoNextSlideCookie = "shouldAutoNextSlideCookie";
    var updateAutoNext = function () {
        shouldAutoNextSlide = $("#autoNextSlide").is(':checked');
        setCookie(shouldAutoNextSlideCookie, shouldAutoNextSlide, cookieDays);
        resetNextSlideTimer();
    };

    var toggleFullScreen = function() {
        var elem = document.getElementById('page');
        if (document.fullscreenElement || // alternative standard method
            document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) { // current working methods
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        } else {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        }
    };

    var nsfwCookie = "nsfwCookie";
    var updateNsfw = function () {
        nsfw = $("#nsfw").is(':checked');
        setCookie(nsfwCookie, nsfw, cookieDays);
    };

    var orderCookie = "orderCookie";
    var updateOrder = function () {
        e621pDescending = $("#descending").is(':checked');
        setCookie(orderCookie, e621pDescending, cookieDays);
    };

    var initState = function () {
        var nsfwByCookie = getCookie(nsfwCookie);
        if (nsfwByCookie == undefined) {
            nsfw = true;
        } else {
            nsfw = (nsfwByCookie === "true");
            $("#nsfw").prop("checked", nsfw);
        }
        $('#nsfw').change(updateNsfw);

        var orderByCookie = getCookie(nsfwCookie);
        if (orderByCookie == undefined) {
            e621pDescending = true;
        } else {
            e621pDescending = (orderByCookie === "true");
            $("#descending").prop("checked", e621pDescending);
        }
        $('#descending').change(updateOrder);


        var autoByCookie = getCookie(shouldAutoNextSlideCookie);
        if (autoByCookie == undefined) {
            updateAutoNext();
        } else {
            shouldAutoNextSlide = (autoByCookie === "true");
            $("#autoNextSlide").prop("checked", shouldAutoNextSlide);
        }
        $('#autoNextSlide').change(updateAutoNext);

        var updateTimeToNextSlide = function () {
            var val = $('#timeToNextSlide').val();
            timeToNextSlide = parseFloat(val) * 1000;
            setCookie(timeToNextSlideCookie, val, cookieDays);
        };

        var timeToNextSlideCookie = "timeToNextSlideCookie";
        timeByCookie = getCookie(timeToNextSlideCookie);
        if (timeByCookie == undefined) {
            updateTimeToNextSlide();
        } else {
            timeToNextSlide = parseFloat(timeByCookie) * 1000;
            $('#timeToNextSlide').val(timeByCookie);
        }

        $('#fullScreenButton').click(toggleFullScreen);

        $('#timeToNextSlide').keyup(updateTimeToNextSlide);

        $('#prevButton').click(prevSlide);
        $('#nextButton').click(nextSlide);
    };

    var addNumberButton = function (numberButton) {
        var navboxUls = $(".navbox ul");
        var thisNavboxUl = navboxUls[navboxUls.length - 1];

        var newListItem = $("<li />").appendTo(thisNavboxUl);
        numberButton.appendTo(newListItem);

        // so li's have a space between them and can word-wrap in the box
        navboxUls.append(document.createTextNode(' '));
    };

    var addImageSlide = function (pic) {
        /*
        var pic = {
            "title": title,
            "url": url,
            "commentsLink": commentsLink,
            "over18": over18,
            "isVideo": video
        }
        */
        pic.isVideo = false;
        if (pic.url.indexOf('gfycat.com') >= 0 | (pic.url.substr(pic.url.lastIndexOf('.')+1)) == "webm"){
            pic.isVideo = true;
            e621pSuccessImageNumber++;
        } else if (isImageExtension(pic.url)) {
            // simple image
            e621pSuccessImageNumber++;
        } else {
            var betterUrl = tryConvertUrl(pic.url);
            if(betterUrl !== '') {
                pic.url = betterUrl;
                e621pSuccessImageNumber++;
            } else {
                if (ep.debug) {
                    reason = ('Picture isn\'t a usable format.');
                    console.log('Failed: ' + pic.url + ' Reason: ' + reason);
                    e621pFailedImageNumber++;
                }
                return;
            }
        }

        ep.foundOneImage = true;

        preLoadImages(pic.url);
        ep.photos.push(pic);

        var i = ep.photos.length - 1;
        var numberButton = $("<a />").html(i + 1)
            .data("index", i)
            .attr("title", ep.photos[i].title)
            .attr("id", "numberButton" + (i + 1));
        if(pic.over18) {
            numberButton.addClass("over18");
        }
        numberButton.click(function () {
            showImage($(this));
        });
        numberButton.addClass("numberButton");
        addNumberButton(numberButton);
    };

    var arrow = {
        left: 37,
        up: 38,
        right: 39,
        down: 40
    };
    var ONE_KEY = 49;
    var NINE_KEY = 57;
    var SPACE = 32;
    var PAGEUP = 33;
    var PAGEDOWN = 34;
    var ENTER = 13;
    var A_KEY = 65;
    var C_KEY = 67;
    var F_KEY = 70;
    var I_KEY = 73;
    var R_KEY = 82;
    var T_KEY = 84;


    // Register keyboard events on the whole document
    $(document).keyup(function (e) {
        if(e.ctrlKey) {
            // ctrl key is pressed so we're most likely switching tabs or doing something
            // unrelated to redditp UI
            return;
        }

        //log(e.keyCode, e.which, e.charCode);

        // 37 - left
        // 38 - up
        // 39 - right
        // 40 - down
        // More info: http://stackoverflow.com/questions/302122/jquery-event-keypress-which-key-was-pressed
        // http://stackoverflow.com/questions/1402698/binding-arrow-keys-in-js-jquery
        var code = (e.keyCode ? e.keyCode : e.which);

        switch (code) {
            case C_KEY:
                $('#controlsDiv .collapser').click();
                break;
            case T_KEY:
                $('#titleDiv .collapser').click();
                break;
            case A_KEY:
                $("#autoNextSlide").prop("checked", !$("#autoNextSlide").is(':checked'));
                updateAutoNext();
                break;
            case I_KEY:
                open_in_background("#navboxLink");
                break;
            case R_KEY:
                open_in_background("#navboxCommentsLink");
                break;
            case F_KEY:
                toggleFullScreen();
                break;
            case PAGEUP:
            case arrow.left:
            case arrow.up:
                return prevSlide();
            case PAGEDOWN:
            case arrow.right:
            case arrow.down:
            case SPACE:
                return nextSlide();
        }
    });


    //
    // Shows an image and plays the animation
    //
    var showImage = function (docElem) {
        // Retrieve the index we need to use
        var imageIndex = docElem.data("index");

        startAnimation(imageIndex);
    };

    var isLastImage = function(imageIndex) {
        if(nsfw) {
            if(imageIndex == ep.photos.length - 1) {
                return true;
            } else {
                return false;
            }
        } else {
            // look for remaining sfw images
            for(var i = imageIndex + 1; i < ep.photos.length; i++) {
                if(!ep.photos[i].over18) {
                    return false;
                }
            }
            return true;
        }
    };
    //
    // Starts the animation, based on the image index
    //
    // Variable to store if the animation is playing or not
    var isAnimating = false;
    var startAnimation = function (imageIndex) {
        resetNextSlideTimer();

        // If the same number has been chosen, or the index is outside the
        // ep.photos range, or we're already animating, do nothing
        if (activeIndex == imageIndex || imageIndex > ep.photos.length - 1 || imageIndex < 0 || isAnimating || ep.photos.length == 0) {
            return;
        }

        isAnimating = true;
        animateNavigationBox(imageIndex);
        slideBackgroundPhoto(imageIndex);

        // Set the active index to the used image index
        activeIndex = imageIndex;

        if (isLastImage(activeIndex) && ep.subredditUrl.indexOf('/imgur') != 0) {
            // e621pPageNumber++;
            getRedditImages();
        }
    };

    var toggleNumberButton = function (imageIndex, turnOn) {
        var numberButton = $('#numberButton' + (imageIndex + 1));
        if (turnOn) {
            numberButton.addClass('active');
        } else {
            numberButton.removeClass('active');
        }
    };

    //
    // Animate the navigation box
    //
    var animateNavigationBox = function (imageIndex) {
        var photo = ep.photos[imageIndex];
        var subreddit = '/r/' + photo.subreddit;

        $('#navboxTitle').html(photo.title);
        //$('#navboxSubreddit').attr('href', ep.redditBaseUrl + subreddit).html(subreddit);
        $('#navboxLink').attr('href', photo.url).attr('title', photo.title);
        $('#navboxCommentsLink').attr('href', photo.commentsLink).attr('title', "Comments on e621");

        toggleNumberButton(activeIndex, false);
        toggleNumberButton(imageIndex, true);
    };

    //
    // Slides the background photos
    //
    var slideBackgroundPhoto = function (imageIndex) {

        // Retrieve the accompanying photo based on the index
        var photo = ep.photos[imageIndex];

        // Create a new div and apply the CSS
        var cssMap = Object();
        cssMap['display'] = "none";
        if(!photo.isVideo) {
            cssMap['background-image'] = "url(" + photo.url + ")";
            cssMap['background-repeat'] = "no-repeat";
            cssMap['background-size'] = "contain";
            cssMap['background-position'] = "center";
        }

        //var imgNode = $("<img />").attr("src", photo.image).css({opacity:"0", width: "100%", height:"100%"});
        var divNode = $("<div />").css(cssMap).addClass("clouds");
        if(photo.isVideo & photo.url.indexOf('gfycat.com') >= 0) {
            clearTimeout(nextSlideTimeoutId);
            var gfyid = photo.url.substr(1 + photo.url.lastIndexOf('/'));
            if(gfyid.indexOf('#') != -1)
                gfyid = gfyid.substr(0, gfyid.indexOf('#'));
            divNode.html('<img class="gfyitem" data-id="'+gfyid+'" data-controls="false"/>');
        }
        if(photo.isVideo & photo.url.indexOf('gfycat.com') >= 0 | (photo.url.substr(photo.url.lastIndexOf('.')+1)) == "webm"){
          //console.log("correct");
          divNode.html('<video autoplay class="webm" width="100%" height="100%" onended="slideNext()" controls> <source src="'+photo.url+'"type="video/webm"></video>');
        }

        //imgNode.appendTo(divNode);
        divNode.prependTo("#pictureSlider");

        $("#pictureSlider div").fadeIn(animationSpeed);
        if(photo.isVideo & photo.url.indexOf('gfycat.com') >= 0){
          //console.log("giffy");
            gfyCollection.init();
            //ToDo: find a better solution!
            $(divNode).bind("DOMNodeInserted", function(e) {
                if(e.target.tagName.toLowerCase() == "video") {
                    var vid = $('.gfyitem > div').width('100%').height('100%');
                    vid.find('.gfyPreLoadCanvas').remove();
                    var v = vid.find('video').width('100%').height('100%');
                    vid.find('.gfyPreLoadCanvas').remove();
                    if (shouldAutoNextSlide)
                        v.removeAttr('loop');
                    v[0].onended = function (e) {
                        if (shouldAutoNextSlide){
                          setTimeout(function(){nextSlide();},500);
                        }

                    };
                }
            });
        }else{
          $(divNode).bind("DOMNodeInserted", function(e) {
               var vid = $('#pictureSlider > div > video');
               var v = vid[0];
               v[0].onended = function (e) {
                 if (shouldAutoNextSlide)
                     nextSlide();
                   };
               });
        }

        var oldDiv = $("#pictureSlider div:not(:first)");
        oldDiv.fadeOut(animationSpeed, function () {
            oldDiv.remove();
            isAnimating = false;
        });

    };



    var verifyNsfwMakesSense = function() {
        // Cases when you forgot NSFW off but went to /r/nsfw
        // can cause strange bugs, let's help the user when over 80% of the
        // content is NSFW.
        var nsfwImages = 0;
        for(var i = 0; i < ep.photos.length; i++) {
            if(ep.photos[i].over18) {
                nsfwImages += 1;
            }
        }

        if(0.8 < nsfwImages * 1.0 / ep.photos.length) {
            nsfw = true;
            $("#nsfw").prop("checked", nsfw);
        }
    };


    var tryConvertUrl = function (url) {
        if (url.indexOf('imgur.com') > 0 || url.indexOf('/gallery/') > 0) {
            // special cases with imgur

            if (url.indexOf('gifv') >= 0) {
                if (url.indexOf('i.') === 0) {
                    url = url.replace('imgur.com', 'i.imgur.com');
                }
                return url.replace('.gifv', '.gif');
            }

            if (url.indexOf('/a/') > 0 || url.indexOf('/gallery/') > 0) {
                // albums aren't supported yet
                //console.log('Unsupported gallery: ' + url);
                return '';
            }

            // imgur is really nice and serves the image with whatever extension
            // you give it. '.jpg' is arbitrary
            // regexp removes /r/<sub>/ prefix if it exists
            // E.g. http://imgur.com/r/aww/x9q6yW9
            return url.replace(/r\/[^ \/]+\/(\w+)/, '$1') + '.jpg';
        }

        return '';
    };
    var goodExtensions = ['.jpg', '.jpeg', '.gif', '.bmp', '.png','.webm'];
    var isImageExtension = function (url) {
        var dotLocation = url.lastIndexOf('.');
        if (dotLocation < 0) {
            log("skipped no dot: " + url);
            return false;
        }
        var extension = url.substring(dotLocation);

        if (goodExtensions.indexOf(extension) >= 0) {
            return true;
        } else {
            //log("skipped bad extension: " + url);
            return false;
        }
    };

    var decodeUrl = function (url) {
        return decodeURIComponent(url.replace(/\+/g, " "));
    };
    ep.getRestOfUrl = function () {
        // Separate to before the question mark and after
        // Detect predefined reddit url paths. If you modify this be sure to fix
        // .htaccess
        // This is a good idea so we can give a quick 404 page when appropriate.

        var regexS = "(/(?:(?:r/)|(?:imgur/a/)|(?:user/)|(?:domain/)|(?:search))[^&#?]*)[?]?(.*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.href);
        //log(results);
        if (results === null) {
            return ["", ""];
        } else {
            return [results[1], decodeUrl(results[2])];
        }
    };

    var failCleanup = function() {
        if (ep.photos.length > 0) {
            // already loaded images, don't ruin the existing experience
            return;
        }

        // remove "loading" title
        $('#navboxTitle').text('');

        // display alternate recommendations
        $('#recommend').css({'display':'block'});
    };

    var getRedditImages = function () {
        //if (noMoreToLoad){
        //    log("No more images to load, will rotate to start.");
        //    return;
        //}

        loadingNextImages = true;
        e621pFailedImageNumber = 0;
        e621pSuccessImageNumber = 0;

        //Checks what the NSFW tag is and sets the image rating
        if(nsfw){
            e621pRating = "rating:e";
            //Leaving out questionable from NSFW -- If Wanting questionable in NSFW uncomment line below
            //rating = rating+"+rating:q";
        }else{
            e621pRating = "rating:s";
            //Leading out questinable from SFW -- If Wanting questionable in SFW uncomment line below
            //rating = rating+"+rating:q";
        }

        var jsonUrl = "https://e621.net/posts.json?tags="+e621pRating+"+"+e621pTags +"&limit="+ e621pLimit+`&page=${e621pAfterId != 0 ? (e621pDescending ? "b": "a") : ("") }`+e621pAfterId;
        //console.log(jsonUrl);
        //log(jsonUrl);
        var failedAjax = function (data) {
            alert("Failed ajax, maybe a bad url? Sorry about that :(");
            failCleanup();
        };
        var handleData = function (data) {
            //redditData = data //global for debugging data
            // NOTE: if data.data.after is null then this causes us to start
            // from the top on the next getRedditImages which is fine.
            // after = "&after=" + data.data.after;

            returnJson = data;

            console.log(data)

            if (returnJson.length === 0) {
                alert("No data from this url :(");
                return;
            }

            $.each(returnJson.posts, function (i, item) {
                console.log(i, item)
                if(item.rating == "e" | item.rating == "q"){
                    isOver18 = true;
                }else{
                    isOver18 = false;
                }

                //Prime AfterID
                if(e621pAfterId === 0) e621pAfterId = item.id

                if(e621pDescending){
                    if(item.id < e621pAfterId){
                        e621pAfterId = item.id
                    }
                }else{
                    if(item.id > e621pAfterId){
                        e621pAfterId = item.id
                    }
                }
                if(item.file.url == null){
                    //Item has been deleted, continue.
                    return
                }
                
                addImageSlide({
                    url: item.file.url,
                    title: item.tags.artist,
                    over18: isOver18,
                    subreddit: "",
                    commentsLink: "https://e621.net/post/show/" + item.id
                });
            });

            verifyNsfwMakesSense();

            if (!ep.foundOneImage) {
                // Note: the jsonp url may seem malformed but jquery fixes it.
                //log(jsonUrl);
                alert("Sorry, no displayable images found in that url :(");
                getRedditImages();
                startAnimation(imageIndex + 1);
            }

            // show the first image
            if (activeIndex == -1) {
                startAnimation(0);
            }

            if (e621pFailedImageNumber + e621pSuccessImageNumber == e621pLimit) {
                e621pPageNumber++;
                if(isLastImage(activeIndex)){
                  //Loads next API page if at end of list and starts navigation.
                  getRedditImages();
                }
                return;
            }else{
                // console.log(e621pFailedImageNumber);
                // console.log(e621pSuccessImageNumber);
                // console.log(e621pLimit);
                //alert("No more data from this URL :(")
                return;
            }

            // If the total number of posts in the API are smaller than the total posts requested per page, not enough to fill page, hence no more pages.
            if (returnJson.length < limit) {
                log("No more pages to load from the API, reloading the start");

                // Show the user we're starting from the top
                var numberButton = $("<span />").addClass("numberButton").text("-");
                addNumberButton(numberButton);
            }
            loadingNextImages = false;

        };

        // I still haven't been able to catch jsonp 404 events so the timeout
        // is the current solution sadly.
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjax,
            404: failedAjax,
            timeout: 5000
        });
    };

    // var getImgurAlbum = function (url) {
    //     var albumID = url.match(/.*\/(.+?$)/)[1];
    //     var jsonUrl = 'https://api.imgur.com/3/album/' + albumID;
    //     //log(jsonUrl);
    //     var failedAjax = function (data) {
    //         alert("Failed ajax, maybe a bad url? Sorry about that :(");
    //         failCleanup();
    //     };
    //     var handleData = function (data) {
    //
    //         //console.log(data);
    //
    //         if (data.data.images.length === 0) {
    //             alert("No data from this url :(");
    //             return;
    //         }
    //
    //         $.each(data.data.images, function (i, item) {
    //             addImageSlide({
    //                 url: item.link,
    //                 title: item.title,
    //                 over18: item.nsfw,
    //                 commentsLink: ""
    //             });
    //         });
    //
    //         verifyNsfwMakesSense();
    //
    //         if (!ep.foundOneImage) {
    //             log(jsonUrl);
    //             alert("Sorry, no displayable images found in that url :(");
    //         }
    //
    //         // show the first image
    //         if (activeIndex == -1) {
    //             startAnimation(0);
    //         }
    //
    //         //log("No more pages to load from this subreddit, reloading the start");
    //
    //         // Show the user we're starting from the top
    //         //var numberButton = $("<span />").addClass("numberButton").text("-");
    //         //addNumberButton(numberButton);
    //
    //         loadingNextImages = false;
    //     };
    //
    //     $.ajax({
    //         url: jsonUrl,
    //         dataType: 'json',
    //         success: handleData,
    //         error: failedAjax,
    //         404: failedAjax,
    //         timeout: 5000,
    //         beforeSend : function(xhr) {
    //             xhr.setRequestHeader('Authorization',
    //                 'Client-ID ' + 'f2edd1ef8e66eaf');}
    //     });
    // };

    var setupUrls = function() {
        ep.urlData = ep.getRestOfUrl();
        //log(ep.urlData)
        ep.subredditUrl = ep.urlData[0];
        getVars = ep.urlData[1];

        if (getVars.length > 0) {
            getVarsQuestionMark = "?" + getVars;
        } else {
            getVarsQuestionMark = "";
        }

        // // Remove .compact as it interferes with .json (we got "/r/all/.compact.json" which doesn't work).
        // ep.subredditUrl = ep.subredditUrl.replace(/.compact/, "");
        // // Consolidate double slashes to avoid r/all/.compact/ -> r/all//
        // ep.subredditUrl = ep.subredditUrl.replace(/\/{2,}/, "/");
        //
        // var subredditName;
        // if (ep.subredditUrl === "") {
        //     ep.subredditUrl = "/";
        //     subredditName = "reddit.com" + getVarsQuestionMark;
        //     //var options = ["/r/aww/", "/r/earthporn/", "/r/foodporn", "/r/pics"];
        //     //ep.subredditUrl = options[Math.floor(Math.random() * options.length)];
        // } else {
        //     subredditName = ep.subredditUrl + getVarsQuestionMark;
        // }
        //
        //
        // var visitSubredditUrl = ep.redditBaseUrl + ep.subredditUrl + getVarsQuestionMark;
        //
        // // truncate and display subreddit name in the control box
        // var displayedSubredditName = subredditName;
        // // empirically tested capsize, TODO: make css rules to verify this is enough.
        // // it would make the "nsfw" checkbox be on its own line :(
        // var capsize = 19;
        // if(displayedSubredditName.length > capsize) {
        //     displayedSubredditName = displayedSubredditName.substr(0,capsize) + "&hellip;";
        // }
        $('#subredditUrl').html("<a href=\' https://www.e621.net \'> E621.net</a>");

        document.title = "e621p - " + (e621pTags ? e621pTags : "Latest");
    };




    ep.redditBaseUrl = "http://www.reddit.com";
    if (location.protocol === 'https:') {
        // page is secure
        ep.redditBaseUrl = "https://www.reddit.com";
        // TODO: try "//" instead of specifying the protocol
    }

    var getVars;
    // var after = "";

    initState();
    setupUrls();

    // if ever found even 1 image, don't show the error
    ep.foundOneImage = false;

    // if(ep.subredditUrl.indexOf('/imgur') == 0)
    //     getImgurAlbum(ep.subredditUrl);
    // else
        getRedditImages();

        window.slideNext = function(){
            if(!nsfw) {
                for(var i = activeIndex + 1; i < ep.photos.length; i++) {
                    if (!ep.photos[i].over18) {
                        return startAnimation(i);
                    }
                }
            }
            if (isLastImage(activeIndex) && !loadingNextImages) {
                // the only reason we got here and there aren't more pictures yet
                // is because there are no more images to load, start over
                return startAnimation(0);
            }
            startAnimation(activeIndex + 1);
        }
});
