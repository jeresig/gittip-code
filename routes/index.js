
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.render('index', { title: 'Gittip Github Repos and NPM Modules' });
};

/**
 * Config variables
 */

var npmURL = "https://registry.npmjs.org/%s";
var gittipURL = "https://www.gittip.com/on/github/%s/";
var githubURL = "https://api.github.com/repos/%s/%s/collaborators";

// Utility-related modules
var _ = require("lodash");
var util = require("util");
var async = require("async");
var request = require("request");

/**
 * Utility methods
 */

var getPckgData = async.memoize(function(pckgName, callback) {
    request(util.format(npmURL, pckgName), function(err, res, data) {
        var retData = null;

        if (!err && res.statusCode === 200) {
            try {
                retData = JSON.parse(data);
            } catch(e) {
                // ERROR: Parsing NPM package data.
            }
        }

        callback(err, retData);
    });
});

var extractGithubRepo = function(pckgData) {
    var githubRepo = null;

    if (pckgData !== null) {
        if (typeof pckgData.repository === "object") {
            var repoURL = pckgData.repository.url;
            if (/github.com\/([^\/]+)\/([^\/]+).git/.test(repoURL)) {
                githubRepo = {
                    user: RegExp.$1,
                    name: RegExp.$2
                };
            }
        }
    }

    return githubRepo;
};

var getPckgOwners = async.memoize(function(pckgName, callback) {
    getPckgData(pckgName, function(err, pckgData) {
        var repo = extractGithubRepo(pckgData);

        if (repo !== null) {
            getRepoCollabs(repo.user, repo.name, callback);
        } else {
            callback(null, null);
        }
    });
});

var getRepoCollabs = async.memoize(function(user, repo, callback) {
    var url = util.format(githubURL, user, repo);
    request.get(url, function(err, res, body) {
        if (!err && res.statusCode === 200) {
            try {
                var items = JSON.parse(body);

                var githubUsers = items.map(function(item) {
                    return item.login;
                });

                async.map(githubUsers, getGittipUser, function(err, data) {
                    callback(null, data);
                });

                return;
            } catch(e) {
                // ERROR: Parsing Github repo data.
            }
        }

        callback(null, null);
    });
});

var getGittipUser = async.memoize(function(pckgOwner, callback) {
    var url = util.format(gittipURL, pckgOwner),
        options = {followRedirect: false};

    request.head(url, options, function(err, res, body) {
        var gittipUser = null;

        if (!err && res.statusCode === 302) {
            var loc = res.headers.location;

            if (loc) {
                gittipUser = loc.replace(/\//g, "");
            }
        }

        callback(null, gittipUser);
    });
});

var gittipFromPckg = async.memoize(function(pckgName, callback) {
    var ret = {};

    getPckgData(pckgName, function(err, pckg) {
        if (err || !pckg) {
            return callback(null, ret);
        }

        var latest = pckg.versions[pckg['dist-tags'].latest];

        var allPckgs = [pckgName]
            .concat(Object.keys(latest.dependencies || {}))
            .concat(Object.keys(latest.devDependencies || {}));

        async.map(allPckgs, getPckgOwners, function(err, data) {
            // Only get a unique set of non-null results
            callback(null, _.countBy(_.filter(_.flatten(data))));
        });
    });
});

exports.npmredirect = function(req, res) {
    if (req.query.name) {
        res.redirect("/npm/" + req.query.name);
    } else {
        res.redirect("/");
    }
};

exports.npmview = function(req, res) {
    var repoName = req.params.name.replace(/[^\w_.-]/g, "");

    gittipFromPckg(repoName, function(err, userData) {
        var users = Object.keys(userData).sort(function(a, b) {
            return userData[b] - userData[a];
        }).map(function(user) {
            return {
                user: user,
                weight: userData[user]
            };
        });

        res.render('npmview', {
            title: "Gittip NPM Module: " + repoName,
            module: repoName,
            users: users
        });
    });
};

exports.githubredirect = function(req, res) {
    if (req.query.user && req.query.repo) {
        res.redirect("/github/" + req.query.user + "/" + req.query.repo);
    } else {
        res.redirect("/");
    }
};

exports.githubview = function(req, res) {
    var userName = req.params.user.replace(/[^\w_.-]/g, "");
    var repoName = req.params.repo.replace(/[^\w_.-]/g, "");

    getRepoCollabs(userName, repoName, function(err, data) {
        var userData = _.countBy(_.filter(data));

        var users = Object.keys(userData).sort(function(a, b) {
            return userData[b] - userData[a];
        }).map(function(user) {
            return {
                user: user,
                weight: userData[user]
            };
        });

        res.render('githubview', {
            title: "Gittip Github Repo: " + userName + "/" + repoName,
            userName: userName,
            repoName: repoName,
            users: users
        });
    });
};