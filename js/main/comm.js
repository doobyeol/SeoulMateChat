$(document).ready(function () {
  $(function () {
    var i;
    $('.sub_menu li').hover(function() {
     	i = $('.sub_menu li').index(this);
     	$('.main_menu li').eq(i).children().addClass('on');
     }, function() {
     	$('.main_menu li').eq(i).children().removeClass('on');
     });
    
     $(".btn_chat").click(function () {
       if ($(".chat_window").hasClass("on") == true) {
         $(".chat_window").css("transition", ".3s");
         $(".chat_window").removeClass("on");
         $("iframe").css("width", "370px");
         $("iframe").css("height", "580px");
       } else {
         $(".chat_window").addClass("on");
         $(".chat_window").css("transition", ".3s");
       }
     });
     
    $('html').click(function(e) {
		if ($(e.target).hasClass(".chat_wrap") == false) {
			alert('!!');
			$('.chat_window').css('transition', '.3s');
			$('.chat_window').removeClass('on');
		}
	});
    
    $('.chat_window').toggleClass('on');
    
    $('.chat_room_list li a').click(function(){
    	$('.chat_on').addClass('on');
	});
  });
});
