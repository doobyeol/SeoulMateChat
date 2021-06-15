/**
 * http://192.168.0.118:9091/chat
 */

var http = require("http");
var fs = require("fs");
var mime = require("Mime");

var express = require("express");
var ejs = require("ejs");

// ======================== JDBC ========================== //
var oracledb = require("oracledb");
oracledb.autoCommit = true; // 자동커밋이 되도록 설정

// 비동기 로직 정렬 nimble
var flow = require('nimble');

// DB연결 정보 설정
var conn; // DB연결정보를 보관할 전역변수
oracledb.getConnection(
  {
    user: "c##seoulmate",
    password: "seoul",
    connectString: "bitcamp4.iptime.org:1522/xe",
  },
  function (error, con) {
    // 연결이 완료되거나 에러가 발생하면 호출되는 콜백함수
    if (error) {
      // 연결실패시
      console.log("DB연결실패");
    } else {
      // 연결성공시
      conn = con;
      console.log("DB연결성공");
    }
  }
);

// ======================================================== //

// express객체 생성
var app = express();
var server = http.createServer(app);

// =========== POST 방식 전송시 데이터 parser 설정 ============== //
var bodyParser = require("body-parser");
app.use(express.static(__dirname)); // express에 기본 디렉토리 설정
app.use(bodyParser.urlencoded({ extended: true })); // 한글인코딩 셋팅


// 서버에 get방식으로 접속 (채팅목록 접속시)
app.get("/chat", function (request, response) {
	var picsJson= "{";
	var chatListResult = null;
	var chatFileResult = null;
	var logName = request.param("username");
	var logId = request.param("userid");
	var back = request.param("back");

	// 채팅방 목록 가져오기
	var sql =
  "select no, name, chatuser1, chatuser2, to_char(chatroomdate, 'YY-MM-DD HH24:MI') chatroomdate, user1alert, user2alert, user1join, user2join from chatroom where chatuser1 = '" +
  logId +
  "' or chatuser2='" +
  logId +
  "' order by no desc";
	
	// 각 채팅방의 최신메세지 가져오기
	var sql2 =
  "select view1.no, view1.content, to_char(view1.senddate, 'YY-MM-DD HH24:MI') senddate from chatview view1 left join chatview view2 on view1.no = view2.no and view1.num < view2.num where view2.no is null and (view1.senduser = '" +
  logId +
  "' or view1.receiveuser = '" +
  logId +
  "') order by view1.no desc";
	
	// 비동기 로직 정렬
	flow.series([
		// 채팅방 목록 가져오기
		function (callback){
			setTimeout(function(){
			  conn.execute(sql, function (error, results) {
					console.log('1. 채팅방 목록 가져오기');
					chatListResult = results;
			  });
				callback();
			}, 100);
		}, // 1번째 수행
		
		// 채팅방 아이디 프로필 사진들을 가져오기
		function (callback){
			setTimeout(function(){
				if(chatListResult.rows.length > 0){
					var sql3 = "select profilepic, userid from member where userid ='" + chatListResult.rows[0][2] + "' or userid='" + chatListResult.rows[0][3] + "'";
					for (var i = 1; i < chatListResult.rows.length; i++) {
						sql3 += " or userid ='" + chatListResult.rows[i][2] + "' or userid='" + chatListResult.rows[i][3] + "'";						
					}
					conn.execute(sql3, function(error, results3){
						console.log('2. 프로필 사진들을 가져오기');
						picsJson = "{";
						for (var i = 0; i < results3.rows.length; i++) {
							if(i == 0){
								picsJson += "\""+results3.rows[i][1]+"\":\""+results3.rows[i][0]+"\"";
							}else if(i > 0){
								picsJson += ", \""+results3.rows[i][1]+"\":\""+results3.rows[i][0]+"\"";
							}
						}
						picsJson += "}";
					});
				}	
				callback();
			}, 100);
		}, // 2번째 수행
		
		// 각 채팅방마다 최근 메세지 정보 가져오기
		function (callback){
			setTimeout(function(){
				console.log('3-1. 최근 메세지 정보 가져오기');
				conn.execute(sql2, function (error, results9) {
					if(error){
						console.log('3-2. 최근 메세지 정보 에러');
					}else{
						console.log('3-2. 최근 메세지 정보 가져오기');
						chatFileResult = results9;
					}
				});
				callback();
			}, 100);
		}, // 3번째 수행
		
		// 채팅방 파일 읽기
		function (callback){
			setTimeout(function(){
			  fs.readFile(__dirname + "\\chatting.ejs", "utf-8", function (error, data) {
			    if (error) {
			      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			      response.end("<h1>File Read Error ...</h1>");
			    } else {
						console.log('4. 채팅방 파일 읽기');
						response.writeHead(200, {
							"Content-Type": "text/html; charset=utf-8",
						});
						if(picsJson == '{'){
							response.end(
								ejs.render(data, {
									username: logName,
									userid: logId,
									result: chatListResult,
									result2: chatFileResult,
									back: back
								})
							);	
						}else if(picsJson != '{'){
							response.end(
								ejs.render(data, {
									username: logName,
									userid: logId,
									result: chatListResult,
									result2: chatFileResult,
									back: back,
									pics : JSON.parse(picsJson)
								})
							);	
						}
			    	}
			  	});
			}, 100);
		} // 4번째 수행
	]);
});


// (채팅보기 접속시)
app.get("/chatView", function (request, response) {
	var no = request.param("no");
	var otherid = request.param("otherid");
	var logId = request.param("userid");
	var logName = request.param("username");
	var admin = request.param('admin');
	var userpic = request.param('userpic');
	var otherpic = request.param('otherpic');
	var sql =
    "select num, no, senduser, receiveuser, content, to_char(senddate, 'YY-MM-DD HH24:MI') senddate from chatview where no=" +
    no +
    "order by num asc";
	
	var msgList;
	
	flow.series([
		// 채팅방 정보 가져오기
		function (callback){
			setTimeout(function(){
			  conn.execute(sql, function (error, results) {
					console.log('1. 채팅방 정보 가져오기');
					chatListResult = results;
			  });
				callback();
			}, 100);
		}, // 1번째 수행
		
		// 채팅 메세지 목록 가져오기
		function (callback){
			setTimeout(function(){
				// 채팅 메세지 목록 가져오기
				conn.execute(sql, function (error, results) {
					msgList = results;
				  if (error) {
				    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				    res.end("채팅뷰 레코드 선택 에러");
				  } else {
						if(results.rows.length > 0){
							sql3 = "select profilepic, userid from member where userid ='" + results.rows[0][2] + "' or userid='" + results.rows[0][3] + "'";
							for (var i = 1; i < results.rows.length; i++) {
								sql3 += " or userid ='" + results.rows[i][2] + "' or userid='" + results.rows[i][3] + "'";						
							}
						}
				  }
				});
				callback();
			}, 100);
		}, // 2번째 수행
		
		function (callback){
			setTimeout(function(){
				// 채팅 파일읽기
				fs.readFile(__dirname + "\\chatView.ejs", "utf-8", function (error, data) {
				    if (error) {
				      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				      response.end("<h1>File Read Error ...</h1>");
				    } else {
						response.writeHead(200, {
						  "Content-Type": "text/html; charset=utf-8",
						});
						response.end(
						  ejs.render(data, {
							username: logName,
							userid : logId,
							otherId: otherid,
							result: msgList,
							userpic : userpic,
							otherpic : otherpic,
							chat_no : no,
							admin : admin
						  })
						);	
				    }
				});
			},100);
		} // 3번째 수행
	]);
});

// 이미지 처리
app.get("/img/*", function (req, res) {
  var path = req.url; 
  var imgMime = mime.getType(path.substring(1));

  fs.readFile(".." + path, function (error, data) {
    if (!error) {
      res.writeHead(200, { "Content-Type": imgMime });
      res.end(data);
    }
  });
});

// css 처리
app.get("/css/*", function (req, res) {
  var path = req.url;
  var cssMime = mime.getType(path.substring(1));

  fs.readFile(".." + path, function (error, data) {
    if (!error) {
      res.writeHead(200, { "Content-Type": cssMime });
      res.end(data);
    }
  });
});

// js 처리
app.get("/js/*", function (req, res) {
  var path = req.url;
  var jsMime = mime.getType(path.substring(1));

  fs.readFile(".." + path, function (error, data) {
    if (!error) {
      res.writeHead(200, { "Content-Type": jsMime });
      res.end(data);
    }
  });
});

// ============ 접속 대기 ============== //
server.listen(9091, function () {
  console.log("server start ... http://192.168.0.118:9091/chat");
});

var socketio = require("socket.io")(http);
var io = socketio.listen(server);

// 채팅보기 connection 이벤트
io.sockets.on("connection", function (socket) {
	console.log("채팅보기 접속");
  
	// 채팅신고(report)
	socket.on("report", function(chat_no, otherId, userid, r_category, r_content){
		console.log(chat_no + " " + otherId + " " + userid + " " + r_category + " " + r_content);
		var r_sql = "insert into report(num, no, category, reportid, userid, reportcategory, reportcontent) values(reportsq.nextval, " + chat_no + ", '채팅', '" + userid + "', '" + otherId + "', '" + r_category + "', '" + r_content + "')";
		conn.execute(r_sql, function(error, result){
			console.log('채팅 신고하기');
		});
	});
	
	// 방만들기(join)	
	socket.on("join", function (userid, otherid, no) {
		var chat_username; // 내 아이디
		var chat_othername; // 상대방 아이디
		var chat_no; // 채팅방 번호
		chat_username = userid;
		chat_othername = otherid;
		chat_no = no;
		
	    socket.join(chat_username);
	    socket.join(chat_othername);
	    socket.join(chat_no); 
		
		var chat_num1; // chatuser1
		var chat_num2; // chatuser2
		
		flow.series([
			function (callback){
				setTimeout(function(){
					// 로그인 아이디가 chatuser1인지 2인지 검사
					var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + chat_username + "' and no = " + chat_no;
					var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + chat_username + "' and no = " + chat_no;
					conn.execute(chatuser1_check, function(error, result){
						chat_num1 = result.rows[0][0];
					});
					conn.execute(chatuser2_check, function(error, result){
						chat_num2 = result.rows[0][0];
					});
					callback();
				}, 100);
			}, // 1번째 수행
			
			// 알림 업데이트
			function (callback){
				setTimeout(function(){
					// chatuser1일때
					if(chat_num1 == 1 && chat_num2 == 0){
						var alert2 = "update chatroom set user2alert = (select count(num) from chatview where no = " + chat_no + ") where no = " + chat_no;
						conn.execute(alert2, function (error, userResult) {
							console.log('alert2 업데이트');
						});
					// chatuser2일때
					}else if(chat_num2 == 1 && chat_num1 == 0){
						var alert1 = "update chatroom set user1alert = (select count(num) from chatview where no = " + chat_no + ") where no = " + chat_no;
						conn.execute(alert1, function (error, userResult) {
							console.log('alert1 업데이트');
						});
					}
					callback();
				}, 100);
			} // 2번째 수행
		]);
	});

	// 같은 방에 있는 접속자에게 받은 메세지 보내기
	socket.on("message", function (msg, userid, otherid, chat_no) {
		var chat_username = userid; // 내 아이디
		var chat_othername = otherid; // 상대방 아이디
		var chat_no = chat_no; // 채팅방 번호
	    var sql =
	      "insert into chatview values(chatviewsq.nextval, " +
	      chat_no +
	      ", '" +
	      chat_username +
	      "', '" +
	      chat_othername +
	      "', '" +
	      msg +
	      "', sysdate)";
	    var sql2 =
	      "select num, no, senduser, receiveuser, content, to_char(senddate, 'YY-MM-DD HH24:MI') senddate from chatview where senduser = '" + chat_username + "' and rownum = 1 order by num desc";
		
		var chat_num1; // chatuser1
		var chat_num2; // chatuser2
		
		flow.series([
			function (callback){
				setTimeout(function(){
					// 로그인 아이디가 chatuser1인지 2인지 검사
					var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + chat_username + "' and no = " + chat_no;
					var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + chat_username + "' and no = " + chat_no;
					conn.execute(chatuser1_check, function(error, result){
						chat_num1 = result.rows[0][0];
					});
					conn.execute(chatuser2_check, function(error, result){
						chat_num2 = result.rows[0][0];
					});
					callback();
				}, 100);
			}, // 1번째 수행
			
			// 알림 업데이트
			function (callback){
				setTimeout(function(){
					// chatuser1일때
					if(chat_num1 == 1 && chat_num2 == 0){
						console.log(chat_username +'은 chatuser1이다.');
						var alert2 = "update chatroom set user2alert = (select count(num) from chatview where no = " + chat_no + ") where no = " + chat_no;
						conn.execute(alert2, function (error, userResult) {
							console.log('alert2 업데이트');
						});
					// chatuser2일때
					}else if(chat_num2 == 1 && chat_num1 == 0){
						var alert1 = "update chatroom set user1alert = (select count(num) from chatview where no = " + chat_no + ") where no = " + chat_no;
						conn.execute(alert1, function (error, userResult) {
							console.log('alert1 업데이트');
						});
					}
					callback();
				}, 100);
			}
		]);

		conn.execute(sql, function (error, result) {
			if (error) {
				console.log("메세지 전송 에러");
			}else {
				conn.execute(sql2, function (error, result5) {	
					socketio.to(chat_no).emit("response", chat_username, msg, chat_othername, result5);
				});
			}
		});
	});
  
	
	// 채팅방에서 상대가 나갔는지 확인
	socket.on("joinOutCheck", function (userid, otherid, chat_no) {
		var chat_username = userid; // 내 아이디
		var chat_othername = otherid; // 상대방 아이디
		var chat_no = chat_no; // 채팅방 번호

		var chat_num1; // chatuser1
		var chat_num2; // chatuser2
		var otherJoin; // 상대방 참가 여부
		
		// 블랙리스트 검사
		var blackCheck = 0; // 상대가 블랙리스트면 0보다 크다.
		var black_num1;
		var black_num2;
		
		flow.series([
			// 상대가 블랙리스트인지 확인
			function (callback){
				setTimeout(function(){
					var blackSql = "select count(no) from member where userid='" + chat_othername + "' and state = '블랙'";
					conn.execute(blackSql, function (error, result) {
						if(result.rows[0][0] > 0){
							console.log('blackCheck1 : ' + blackCheck);
							blackCheck = result.rows[0][0];
						}
					});
					callback();
				}, 100);
			}, // 1번째 수행
			
			// otherId 아이디가 chatuser1인지 2인지 검사
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + chat_othername + "' and no = " + chat_no;
						var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + chat_othername + "' and no = " + chat_no;
						conn.execute(chatuser1_check, function(error, result){
							black_num1 = result.rows[0][0];
						});
						conn.execute(chatuser2_check, function(error, result){
							black_num2 = result.rows[0][0];
						});
					}
					callback();
				}, 100);
			}, // 2번째 수행
			
			// userjoin == 1 (퇴장) 업데이트	
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(black_num1 == 1 && black_num2 == 0){
							var exit1 = "update chatroom set user1join = 1 where no = " + chat_no;
							conn.execute(exit1, function (error, exitResult) {
								console.log('exit1 업데이트');
							});
						}else if(black_num2 == 1 && black_num1 == 0){
							var exit2 = "update chatroom set user2join = 1 where no = " + chat_no;
							conn.execute(exit2, function (error, exitResult) {
								console.log('exit2 업데이트');
							});
						}
					}
					callback();
				}, 100);
			}, // 3번째 수행
			
			// 로그인 아이디가 chatuser1인지 2인지 검사
			function (callback){
				setTimeout(function(){
					var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + chat_username + "' and no = " + chat_no;
					var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + chat_username + "' and no = " + chat_no;
					conn.execute(chatuser1_check, function(error, result){
						chat_num1 = result.rows[0][0];
					});
					conn.execute(chatuser2_check, function(error, result){
						chat_num2 = result.rows[0][0];
					});
					callback();
				}, 100);
			}, // 4번째 수행
			
			// 유저1인지 유저2인지 검사, 조인 여부 수를 outcheck로 전송 (chatview)
			function (callback){
				setTimeout(function(){
					if(chat_num1 == 1 && chat_num2 == 0){
						var joinSql = "select user2join from chatroom where no = " + chat_no;
					}else if(chat_num2 == 1 && chat_num1 == 0){
						var joinSql = "select user1join from chatroom where no = " + chat_no;
					}
					conn.execute(joinSql, function (error, joinResult) {
						otherJoin = joinResult;
				    io.sockets
							.in(chat_no)
				      .emit("outCheck", otherJoin.rows[0][0], blackCheck);
					});
					callback();
				}, 100);
			} // 5번째 수행
		]);
	});
	
	// 상대가 블랙리스트일때 퇴장처리
	socket.on('blackOutCheck', function(chat_no, otherId){
		var chat_no = chat_no; // 채팅방 번호
		
		var chat_num1; // chatuser1
		var chat_num2; // chatuser2
		var chat_rpt; // report 테이블 검사 여부
		var blackCheck; // black 여부
		var joinRs; // join 여부
		
		flow.series([
			// 상대가 블랙리스트인지 확인
			function (callback){
				setTimeout(function(){
					var blackSql = "select count(no) from member where userid='" + otherId + "' and state = '블랙'";
					conn.execute(blackSql, function (error, result) {
						blackCheck = result.rows[0][0];
					});
					callback();
				}, 100);
			}, // 1번째 수행
			
			// 상대가 블랙리스트일때
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						// otherId 아이디가 chatuser1인지 2인지 검사
						var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + otherId + "' and no = " + chat_no;
						var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + otherId + "' and no = " + chat_no;
						conn.execute(chatuser1_check, function(error, result){
							chat_num1 = result.rows[0][0];
						});
						conn.execute(chatuser2_check, function(error, result){
							chat_num2 = result.rows[0][0];
						});
					}
					callback();
				}, 100);
			}, // 2번째 수행
			
			// userjoin == 1 (퇴장) 업데이트	
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(chat_num1 == 1 && chat_num2 == 0){
							console.log(otherId +'은 chatuser1이다.');
							var exit1 = "update chatroom set user1join = 1 where no = " + chat_no;
							conn.execute(exit1, function (error, exitResult) {
								console.log('exit1 업데이트');
							});
						}else if(chat_num2 == 1 && chat_num1 == 0){
							console.log(otherId +'은 chatuser2이다.');
							var exit2 = "update chatroom set user2join = 1 where no = " + chat_no;
							conn.execute(exit2, function (error, exitResult) {
								console.log('exit2 업데이트');
							});
						}
					}
					callback();
				}, 100);
			}, // 3번째 수행
			
			// 조인 여부 수를 outcheck로 전송 (chatview)
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						var joinSql = "select user1join, user2join from chatroom where no = " + chat_no;
						
						conn.execute(joinSql, function (error, joinResult) {
							joinRs = joinResult;
							if(chat_num1 == 1 && chat_num2 == 0){
								otherJoin = joinResult.rows[0][0];
							}else if(chat_num2 == 1 && chat_num1 == 0){
								otherJoin = joinResult.rows[0][1];
							}
						});
					}
					callback();
				}, 100);
			}, // 4번째 수행
			
			// 둘다 나가면 채팅내역 삭제처리해주기
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
							var delSql = "delete from chatview where no = " + chat_no;
							conn.execute(delSql, function (error, delResult) {
								console.log('채팅내역 삭제됨');
							});
						}
					}
					callback();
				}, 100);
			},// 5번째 수행
			
			// 둘다 나가면 채팅방 삭제처리해주기
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
							var delSql = "delete from chatroom where no = " + chat_no;
							conn.execute(delSql, function (error, delResult) {
								console.log('채팅방 삭제됨');
							});
						}
					}
					callback();
				}, 100);
			},// 6번째 수행
			
			// 둘다 나가면 채팅방이 신고테이블에 있는지 검사
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
							var delRptSql = "select count(no) from report where no=" + chat_no + " and category = '채팅'";
							conn.execute(delRptSql, function (error, result) {
								chat_rpt = result.rows[0][0];
							});
						}
					}
					callback();
				}, 100);
			},// 7번째 수행
			
			// 둘다 나가면 채팅방이 신고테이블에 있는지 검사한뒤 해당 신고테이블의 상태를 '삭제됨'으로 업데이트 해주기
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
							if(chat_rpt > 0){
								var upRptSql = "update report set state = '삭제됨' where no = " + chat_no + " and category = '채팅'";
								conn.execute(upRptSql, function (error, result) {
									console.log('신고된 채팅방 상태 삭제됨으로 변경');
								});
							}
						}
					}
					callback();
				}, 100);
			}, // 8번째 수행
			
			// 블랙리스트 결과 전송
			function (callback){
				setTimeout(function(){
					if(blackCheck > 0){
						if(chat_num1 == 1 && chat_num2 == 0){
							var joinSql = "select user2join from chatroom where no = " + chat_no;
						}else if(chat_num2 == 1 && chat_num1 == 0){
							var joinSql = "select user1join from chatroom where no = " + chat_no;
						}
						conn.execute(joinSql, function (error, joinResult) {
							otherJoin = joinResult;
					    io.sockets
					      .emit("blackOut", chat_no, otherId);
						});
					}
					callback();
				}, 100);
			} // 9번째 수행
		]);
	});
	

	// 채팅방 나가기를 했을때 실행되는 이벤트
	socket.on('chatOut', function(chat_no, logId, otherid){
		var chat_username = logId; // 내 아이디
		var chat_othername = otherid; // 상대방 아이디
		var chat_no = chat_no; // 채팅방 번호
		
		var chat_num1; // chatuser1
		var chat_num2; // chatuser2
		var chat_rpt; // report 테이블 검사 여부
		var joinRs; // join 여부
		
		flow.series([
			// 로그인 아이디가 chatuser1인지 2인지 검사
			function (callback){
				setTimeout(function(){
					var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + logId + "' and no = " + chat_no;
					var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + logId + "' and no = " + chat_no;
					conn.execute(chatuser1_check, function(error, result){
						chat_num1 = result.rows[0][0];
					});
					conn.execute(chatuser2_check, function(error, result){
						chat_num2 = result.rows[0][0];
					});
					callback();
				}, 100);
			}, // 1번째 수행
			
			// userjoin == 1 (퇴장) 업데이트	
			function (callback){
				setTimeout(function(){
					if(chat_num1 == 1 && chat_num2 == 0){
						console.log(chat_username +'은 chatuser1이다.');
						var exit1 = "update chatroom set user1join = 1 where no = " + chat_no;
						conn.execute(exit1, function (error, exitResult) {
							console.log('exit1 업데이트');
						});
					}else if(chat_num2 == 1 && chat_num1 == 0){
						console.log(chat_username +'은 chatuser2이다.');
						var exit2 = "update chatroom set user2join = 1 where no = " + chat_no;
						conn.execute(exit2, function (error, exitResult) {
							console.log('exit2 업데이트');
						});
					}
					callback();
				}, 100);
			}, // 2번째 수행
			
			// 조인 여부 수를 outcheck로 전송 (chatview)
			function (callback){
				setTimeout(function(){
					var joinSql = "select user1join, user2join from chatroom where no = " + chat_no;
					
					conn.execute(joinSql, function (error, joinResult) {
						joinRs = joinResult;
						if(chat_num1 == 1 && chat_num2 == 0){
							otherJoin = joinResult.rows[0][0];
						}else if(chat_num2 == 1 && chat_num1 == 0){
							otherJoin = joinResult.rows[0][1];
						}
				    io.sockets
						.in(chat_no)
						.emit("outCheck", otherJoin);
					});
					callback();
				}, 100);
			},// 3번째 수행
			
			// 둘다 나가면 채팅내역 삭제처리해주기
			function (callback){
				setTimeout(function(){
					if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
						var delSql = "delete from chatview where no = " + chat_no;
						conn.execute(delSql, function (error, delResult) {
							console.log('채팅목록 삭제됨.');
						});
					}
					callback();
				}, 100);
			},// 4번째 수행
			
			// 둘다 나가면 채팅방 삭제처리해주기
			function (callback){
				setTimeout(function(){
					if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
						var delSql = "delete from chatroom where no = " + chat_no;
						conn.execute(delSql, function (error, delResult) {
							console.log('채팅방 삭제됨.');
						});
					}
					callback();
				}, 100);
			},// 5번째 수행
			
			// 둘다 나가면 채팅방이 신고테이블에 있는지 검사
			function (callback){
				setTimeout(function(){
					if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
						var delRptSql = "select count(no) from report where no=" + chat_no + " and category = '채팅'";
						conn.execute(delRptSql, function (error, result) {
							chat_rpt = result.rows[0][0];
							console.log('둘다 나간 채팅방의 신고테이블이 있는지 검사 : ' + chat_rpt);
						});
					}
					callback();
				}, 100);
			},// 6번째 수행
			
			// 둘다 나가면 채팅방이 신고테이블에 있는지 검사한뒤 해당 신고테이블의 상태를 '삭제됨'으로 업데이트 해주기
			function (callback){
				setTimeout(function(){
					if(joinRs.rows[0][0] == 1 && joinRs.rows[0][1] == 1){
						if(chat_rpt > 0){
							var upRptSql = "update report set state = '삭제됨' where no = " + chat_no + " and category = '채팅'";
							conn.execute(upRptSql, function (error, result) {
								console.log('신고된 채팅방 상태 삭제됨 변경');
							});
						}
					}
					callback();
				}, 100);
			}
		]);
	});
	
	// 채팅방목록 입장 join 이벤트
	socket.on("joinRoom", function (logId){
		socket.join(logId);
	});

	// 상대방이 채팅목록에서 메세지를 받을 경우 비동기식 처리
	// 메세지 전송시 실행되는 이벤트
	// 최신메세지 업데이트, 알림수 업데이트 
	socket.on("chatList", function (logId, otherId) {
	    socket.join(logId);
	    socket.join(otherId);
	    var chatFileResult = null;
		
		// 각 채팅방의 최신메세지 가져오기
		var sql2 = "select view1.no, view1.receiveuser, view1.content, to_char(view1.senddate, 'YY-MM-DD HH24:MI') senddate from chatview view1 left join chatview view2 on view1.no = view2.no and view1.num < view2.num where view2.no is null and (view1.senduser = '" + logId +"' and view1.receiveuser = '" + otherId + "') order by senddate desc";
		
		var chat_num1; // chatuser1
		var chat_num2; // chatuser2
		var chat_username; // userid
		var chat_no; // 채팅방 번호
		var alert1; // chatuser2 알림
		var alert2; // chatuser1 알림
		var total; // 전체 메세지 count (알림수 비교)
		
		// 비동기 로직 정렬
		flow.series([
			// 각 채팅방마다 최근 메세지 정보 가져오기
			function (callback){
				setTimeout(function(){
					console.log('3-1. 최근 메세지 정보 가져오기');
					conn.execute(sql2, function (error, results9) {
						if(error){
							console.log('3-2. 최근 메세지 정보 에러');
						}else{
							console.log('3-2. 최근 메세지 정보 가져오기');
							chatFileResult = results9;
							chat_no = chatFileResult.rows[0][0];
							socket.join(chat_no);
							chat_username = chatFileResult.rows[0][1];
						}
					});
					callback();
				}, 100);
			}, // 1번째 수행
			
			// 로그인 아이디가 chatuser1인지 2인지 검사
			function (callback){
				setTimeout(function(){
					var chatuser1_check = "select count(chatuser1) from chatroom where chatuser1 = '" + chat_username + "' and no = " + chat_no;
					var chatuser2_check = "select count(chatuser2) from chatroom where chatuser2 = '" + chat_username + "' and no = " + chat_no;
					conn.execute(chatuser1_check, function(error, result){
						chat_num1 = result.rows[0][0];
					});
					conn.execute(chatuser2_check, function(error, result){
						chat_num2 = result.rows[0][0];
					});
					callback();
				}, 100);
			}, // 2번째 수행
			
			// 알림 업데이트
			function (callback){
				setTimeout(function(){
					if(chat_num2 == 1 && chat_num1 == 0){
						console.log(chat_username +'은 chatuser1이다.');
						var alert2 = "update chatroom set user2alert = (select count(num) from chatview where no = " + chat_no + ") where no = " + chat_no;
						conn.execute(alert2, function (error, userResult) {
							console.log('alert2 업데이트');
						});
					}else if(chat_num1 == 1 && chat_num2 == 0){
						console.log(chat_username +'은 chatuser2이다.');
						var alert1 = "update chatroom set user1alert = (select count(num) from chatview where no = " + chat_no + ") where no = " + chat_no;
						conn.execute(alert1, function (error, userResult) {
							console.log('alert1 업데이트');
						});
					}
					callback();
				}, 100);
			}, // 3번째 수행
			
			// total 전체메세지 & 알림수 비교
			function (callback){
				setTimeout(function(){
					var sql1 = "select user1alert, user2alert from chatroom where no = " + chat_no;
					conn.execute(sql1, function(error, result) {
						alert1 = result.rows[0][0];
						alert2 = result.rows[0][1];
						if(chat_num1 == 1 && chat_num2 == 0){
							if(alert2 - alert1 < 0){
								total = alert1 - alert2;
							}else{
								total = alert2 - alert1;
							}
						}else if(chat_num2 == 1 && chat_num1 == 0){
							if(alert2 - alert1 < 0){
								total = alert1 - alert2;
							}else{
								total = alert2 - alert1;
							}
						}
					});
					callback();
				}, 100);
			}, // 4번째 수행
			
			// chatList result 데이터 보내주기
			function (callback){
				setTimeout(function(){
					var userid = logId;
					var result = chatFileResult;
					io.sockets
						.in(otherId)
						.emit("chatList", userid, result, otherId, chat_no, total);
				}, 100);
			} // 5번째 수행
		]);
	});
});
