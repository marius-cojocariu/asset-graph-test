#!/usr/bin/env node

var AssetGraph = require('assetgraph'), 
	Transforms = AssetGraph.transforms, 
	jsdom = require("jsdom"), 
	seenUrls = [], 
	seenThemeUrls = [], 
	data = [], 
	async = require('async'), 
	sleep = require('sleep'), 
	json2csv = require('json2csv'), 
	fs = require('fs');;

function parseDateFromUrl(url) {
	var pieces = url.split('-'), 
		year = pieces[pieces.length - 1],
		month = pieces[pieces.length - 3],
		day = pieces[pieces.length - 2];

	month = month.
		replace('january', 0).
	    replace('february', 1).
	    replace('march', 2).
	    replace('april', 3).
	    replace('may', 4).
	    replace('june', 5).
	    replace('july', 6).
	    replace('august', 7).
	    replace('september', 8).
	    replace('october', 9).
	    replace('november', 10).
	    replace('december', 11);

	day = day.
		replace('st', '').
		replace('nd', '').
		replace('rd', '').
		replace('th', '');

	year = parseInt(year, 10);
	month = parseInt(month, 10);
	day = parseInt(day, 10);

	return new Date(year, month, day); 
}

new AssetGraph({root: 'http://www.shopify.com/blogsearch?q=new+store+friday'})
	.queue(
		Transforms.loadAssets('http://www.shopify.com/blogsearch?q=new+store+friday'), 
		Transforms.populate({
			followRelations: {
				to: {
					url: /^http:\/\/www.shopify.com\/blogsearch\?page=[\d]+\&q=new\+store\+friday$/
				}
			}
		})
	).run(function(err, assetGraph) {
		assetGraph
        	.findRelations({
        		type:"HtmlAnchor",
        		to: {
        			url: /^http:\/\/www.shopify.com\/blog\/[\d]+\-new\-store\-friday*/
        		}
        	}, true)
		    .forEach(function(elem) {
		    	if(seenUrls.indexOf(elem.to.url) === -1) {
		    		seenUrls[seenUrls.length] = elem.to.url;

		    		var parsedDate = parseDateFromUrl(elem.to.url), 
		    			item = {
			    			date: parsedDate, 
			    			url: elem.to.url, 
			    			themes: []
			    		};

			    	if (Object.prototype.toString.call(parsedDate) === "[object Date]" && !isNaN(parsedDate.getTime())) {
			    		data[data.length] = item;
			    	}
		    	}
		    });

		async.mapSeries(data, function(item, callback) {
			var transformed = {
				date: item.date.toISOString(), 
    			url: item.url, 
    			themes: ""
			};

			jsdom.env(
    			item.url, 
    			["http://code.jquery.com/jquery.js"], 
    			function (errors, window) {
    				if(typeof(window.$) === 'function') {
    					var apps = window.$("#Main article.post div.post-content div.app-showcase"), 
	    					themes = [];

	    				if(apps.length) {
		    				apps.each(function() {
		    					var theme = [], 
		    						$this = window.$(this), 
		    						name;

		    					name = window.$.trim($this.find('h4').text());
		    					if(!name) {
		    						name = window.$.trim($this.find('a:first').text());
		    					}
		    					theme[theme.length] = name;
		    					theme[theme.length] = window.$.trim($this.find('a:first').attr('href'));

		    					themes[themes.length] = theme.join(' - ');
		    				});
	    				} else {
	    					apps = window.$("#Main article.post div.post-content a[target=_blank]");
	    					apps.each(function() {
		    					var theme = [], 
		    						$this = window.$(this), 
		    						href = window.$.trim($this.attr('href')), 
		    						name;

		    					if(seenThemeUrls.indexOf(href) === -1) {
		    						seenThemeUrls[seenThemeUrls.length] = href;

		    						if($this.prev().is('b')) {
				    					name = window.$.trim($this.prev().text());
			    					} else {
			    						name = window.$.trim($this.text());
			    					}
			    					if(!name) {
			    						name = window.$.trim($this.parents('div.post-content:first').find('a[href="' + href + '"]:eq(1)').text());
			    					}
			    					if(name) {
			    						theme[theme.length] = name;
			    					}
			    					theme[theme.length] = href;

			    					themes[themes.length] = theme.join(' - ');
		    					}
		    				});
	    				}

	    				themes = themes.join(', ');
	    				transformed.themes = themes;
    				}
    				

    				sleep.sleep(2);
    				callback(null, transformed);
				}
			);
		}, function(err, results) {
			json2csv({data: results, fields: ['date', 'url', 'themes']}, function(err, csv) {
				if (err) {
					console.error(err);
				} else {
					fs.writeFile("export.csv", csv, function(err) {
					    if(err) {
					        console.error(err);
					    } else {
					        console.log("export.csv saved");
					    }
					});
				}
			});
		});
	});