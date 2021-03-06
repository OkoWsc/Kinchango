#!/usr/bin/nodejs

const express = require('express');
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({
    extended: true
}));
const port = 3111;
const request = require('request');
var cookieparse = require('cookie');
const cheerio = require('cheerio');

companies={
	"kinchbus": {
		"name": "kinchbus",
		"protocol": "https",
		"domain": "kinchbus.co.uk",
		"smartcardurl": "/kinchkard",
		"cardname": "kinchkard"
	},
	"trentbarton": {
		"name": "trentbarton",
		"protocol": "https",
		"domain": "trentbarton.co.uk",
		"smartcardurl": "/mango",
		"cardname": "mango"
	}
};

function get_company(company_tag) {
	if (companies[company_tag]) {
		return companies[company_tag];
	} else {
		return false;
	};
};

app.get('/', function (req, res) {
	res.send('Welcome to Kinchango!');
});

app.post('/:company_tag/signin', function (req, res) {
	var company=get_company(req.params.company_tag);
	if (!company) {
		res.send("Not a valid company");
	};

	var username=req.body.username;
	var password=req.body.password;

	console.log(`Getting ${company.name} smartcardurl viewstate`);
	request(company.protocol+"://"+company.domain+company.smartcardurl, function (error, response, body) {
		console.log(`Got ${company.name} smartcardurl viewstate`);
		if (error) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
		} else {
			console.log('statusCode:', response && response.statusCode);
			//console.log('body:', body);


			console.log(`Loading Cheerio`);
			var $ = cheerio.load(body);
			console.log(`Loaded Cheerio`);

			var formdata={};

			formdata['__EVENTTARGET']="";
			formdata['__EVENTARGUMENT']="";
			formdata['__VIEWSTATE']=$('#__VIEWSTATE').val();
			formdata['__VIEWSTATEGENERATOR']=$('#__VIEWSTATEGENERATOR').val();
			formdata['__EVENTVALIDATION']=$('#__EVENTVALIDATION').val();

			//for trentbarton
			formdata['ctl00$ctl00$Main$ctl00$ctl00$txtUsername']=username;
			formdata['ctl00$ctl00$Main$ctl00$ctl00$txtPassword']=password;
			formdata['ctl00$ctl00$Main$ctl00$ctl00$btnLogin']=$('#Main_ctl00_ctl00_btnLogin').val();

			//for kinchbus
			formdata['ctl00$ctl00$Main$ctl00$ctl01$txtUsername']=username;
			formdata['ctl00$ctl00$Main$ctl00$ctl01$txtPassword']=password;
			formdata['ctl00$ctl00$Main$ctl00$ctl01$btnLogin']=$('#Main_ctl00_ctl01_btnLogin').val();

			
			var jar=request.jar();
			var url=company.protocol+"://"+company.domain+company.smartcardurl;
			console.log(`Posting to ${company.name} smartcard url`);
			request.post({url:url, followRedirect: false, form: formdata,jar: jar}, function(error,response,body){
				console.log(`Posted to ${company.name} smartcard url`);
				if (error) {
					console.log('error:', error);
					console.log('statusCode:', response && response.statusCode);
				} else {
					console.log('statusCode:', response && response.statusCode);

					var cookies=cookieparse.parse(jar.getCookieString(company.protocol+"://"+company.domain+company.smartcardurl));
					jar=null;

					var result={};
					if (cookies['MangoUser_ID']) {
							console.log("Signed in");
							result.status=true;
							result.authenticationtoken=cookies;
					} else {
							console.log("Sign in failure.");
							result.formdata=formdata;
							result.status=false;
							result.status_human=`Failed to sign in. Either incorrect username/password or ${company.name} server error.`;
					};

					res.json(result);
				};
			});

		};
	});
});


app.get('/:company_tag/profile', function (req, res) {
	var company=get_company(req.params.company_tag);
	if (!company) {
		res.send("Not a valid company");
	};

	var url = company.protocol+"://"+company.domain+company.smartcardurl+"/profile";
	var jar=request.jar();
	try {
		var authenticationtoken=JSON.parse(req.query.authenticationtoken);
		jar.setCookie(request.cookie('MangoUser_ID='+authenticationtoken['MangoUser_ID']), url);
		jar.setCookie(request.cookie('MangoUser_Token='+authenticationtoken['MangoUser_Token']), url);
	} catch (error) {
		console.log(error);
		var result={};
		result.status=false;
		result.status_human=`Invalid authentication token`;
		res.json(result);
		return;
	};

	console.log(url);
	request.get({url:url, followRedirect: false, jar: jar}, function(error,response,body){
		console.log(`getting ${company.name} smartcard profile`);
		if (error) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
		} else {
			console.log('statusCode:', response && response.statusCode);

			if (response.statusCode!=200) {
				var result={};
				result.status=false;
				result.status_human=`Unknown status from ${company.name}`;
				res.json(result);
				return;
			};

			var $ = cheerio.load(body);

			var result={};
			result.status=true;
			result.profile={};

			result.profile.name={};
			result.profile.name.title=$('#Main_ctl01_ctrlProfile_drpTitle').val();
			result.profile.name.firstname=$('#Main_ctl01_ctrlProfile_txtFirstName').val();
			result.profile.name.surname=$('#Main_ctl01_ctrlProfile_txtSurname').val();

			result.profile.address={};
			result.profile.address.postcode=$('#Main_ctl01_ctrlProfile_txtPostcode').val();
			result.profile.address.housenumber=$('#Main_ctl01_ctrlProfile_txtHouseNumber').val();
			result.profile.address.street=$('#Main_ctl01_ctrlProfile_txtStreet').val();
			result.profile.address.address1=$('#Main_ctl01_ctrlProfile_txtAddress1').val();
			result.profile.address.address2=$('#Main_ctl01_ctrlProfile_txtAddress2').val();
			result.profile.address.town=$('#Main_ctl01_ctrlProfile_txtTown').val();
			result.profile.address.county=$('#Main_ctl01_ctrlProfile_txtCounty').val();

			result.profile.misc={};
			result.profile.misc.phone=$('#Main_ctl01_ctrlProfile_txtPhone').val();
			result.profile.misc.email=$('#Main_ctl01_ctrlProfile_txtEmailAddress').val();
			result.profile.misc.dob=$('#Main_ctl01_ctrlProfile_txtDateOfBirth').val();
			result.profile.misc.twitter=$('#Main_ctl01_ctrlProfile_txtTwitterUsername').val();
			result.profile.misc.keepinformed=$('#Main_ctl01_ctrlProfile_chkKeepInformed').is(':checked');

			result.profile.news=[];
			$('.serviceChkBoxList').find('.chkBoxItem').each(function( index ) {
				service={};
				service.name=$(this).find('span').text();
				service.checked=$(this).find('[type="checkbox"]').is(':checked');
				result.profile.news.push(service);
			});

			res.json(result);
		};
	});
});

app.get('/:company_tag/cards', function (req, res) {
	var company=get_company(req.params.company_tag);
	if (!company) {
		res.send("Not a valid company");
	};

	var url = company.protocol+"://"+company.domain+company.smartcardurl+"/my-"+company.cardname;
	var jar=request.jar();
	try {
		var authenticationtoken=JSON.parse(req.query.authenticationtoken);
		jar.setCookie(request.cookie('MangoUser_ID='+authenticationtoken['MangoUser_ID']), url);
		jar.setCookie(request.cookie('MangoUser_Token='+authenticationtoken['MangoUser_Token']), url);
	} catch (error) {
		console.log(error);
		var result={};
		result.status=false;
		result.status_human=`Invalid authentication token`;
		res.json(result);
		return;
	};

	console.log(url);
	request.get({url:url, followRedirect: false, jar: jar}, function(error,response,body){
		console.log(`getting ${company.name} card list`);
		if (error) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
		} else {
			console.log('statusCode:', response && response.statusCode);

			if (response.statusCode!=200) {
				var result={};
				result.status=false;
				result.status_human=`Unknown status from ${company.name}`;
				res.json(result);
				return;
			};

			var $ = cheerio.load(body);

			var result={};
			result.status=true;
			result.cards=[];

			$('.mango-card').each(function() {
                                var card={};
                                card.number=$(this).find('dd').eq(0).text().trim();

                                card.holder=$(this).find('dd').eq(1);
				if (card.holder) {
					card.holder=card.holder.text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
				} else {
					card.holder="";
				};

                                card.name=$(this).find('dd').eq(2);
				if (card.name) {
					card.name=card.name.text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
				} else {
					card.name="";
				};

				card.products=[];
				$(this).find('.productList').find('dl').each(function() {
					product={};
					product.name=$(this).find('dd').eq(0).html();
					product.start=$(this).find('dd').eq(1).html();
					product.expiry=$(this).find('dd').eq(2).html();
					card.products.push(product);
				});

                                result.cards.push(card);
			});

			res.json(result);
		};
	});
});



app.get('/:company_tag/cards/:card_number', function (req, res) {
	var company=get_company(req.params.company_tag);
	if (!company) {
		res.send("Not a valid company");
	};

	var card_number=req.params.card_number;

	//the websites display a card suffix (eg shows 0234567890-1 with suffix being -1)
	//but card specific pages do NOT accept suffix so we need to remove it, if it is given

	if (card_number.slice(-2,-1)=="-") {
		card_number=card_number.slice(0,-2);
	};

	var url = company.protocol+"://"+company.domain+company.smartcardurl+"/my-"+company.cardname+"/journey-history?card="+card_number;

	var jar=request.jar();
	try {
		var authenticationtoken=JSON.parse(req.query.authenticationtoken);
		jar.setCookie(request.cookie('MangoUser_ID='+authenticationtoken['MangoUser_ID']), url);
		jar.setCookie(request.cookie('MangoUser_Token='+authenticationtoken['MangoUser_Token']), url);
	} catch (error) {
		console.log(error);
		var result={};
		result.status=false;
		result.status_human=`Invalid authentication token`;
		res.json(result);
		return;
	};

	console.log(url);
	request.get({url:url, followRedirect: false, jar: jar}, function(error,response,body){
		console.log(`getting ${company.name} card info for card ${card_number}`);
		if (error) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
		} else {
			console.log('statusCode:', response && response.statusCode);

			if (response.statusCode!=200) {
				var result={};
				result.status=false;
				result.status_human=`Unknown status from ${company.name}`;
				res.json(result);
				return;
			};

			var $ = cheerio.load(body);

			var result={};
			result.status=true;

			result.card={};
			result.card.number=$('.mango-card').find('dd').eq(0).text().trim();

                        result.card.holder=$('.mango-card').find('dd').eq(1);
			if (result.card.holder) {
				result.card.holder=result.card.holder.text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
			} else {
				result.card.holder="";
			};

                        result.card.name=$('.mango-card').find('dd').eq(2);
			if (result.card.name) {
				result.card.name=result.card.name.text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
			} else {
				result.card.name="";
			};

			result.card.journeys=[];
			$('.journey-history').find('tbody').find('tr').not('.head').each(function() {
				var journey={};
				//this will need to be updated to show Mango tap off/destinations

				journey.start_time=$(this).find('td').eq(0).text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
				journey.start_location=$(this).find('td').eq(1).text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
				journey.product=$(this).find('td').eq(2).text().trim().replace(/(\r\n\t|\n|\r\t)/gm,"").replace(/ +(?= )/g,'');
				result.card.journeys.push(journey);	
			});
			res.json(result);
		};
	});
});

app.listen(port, function() {
	for (var company_tag in companies) {
		console.log(`Loaded ${company_tag} on domain ${companies[company_tag]['domain']}`);
	};

	console.log(`Kinchango listening on port ${port}!`)
});
