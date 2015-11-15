var dont_escape_refs;

// !!SET THIS TO FALSE WHEN DOING THE REAL AND FINAL IMPORT!!
//dont_escape_refs = true;

var github;
var labelcounts;
var labelcolors;
var mstonecounts;
var mstonedata;
var mstonemap;
var issues;
var issueoffsets;
var issueidx;

function showRateLimit(json, status, xhr) {
    if (github.rateLimitRemaining != null) {
        $("#limit").text(github.rateLimitRemaining);
        if (limit < 20) {
            $("#monitor").css("background-color", "orangered");
        } else if (limit < 100) {
            $("#monitor").css("background-color", "orange");
        } else {
            $("#monitor").css("background-color", "lightgreen");
        }
    }
}

$(document).ready(function() {
    var auth = new Authentication({
        type: "basic",
        username: "CeylonMigrationBot",
        password: "<put-app-authentication-token-here>"
    });
    github = new GitHub({
        authentication: auth,
        pageSize: 100,
        maxRequests: 999,
        monitor: showRateLimit
    });
});

var repos = {
    "ceylon-compiler": "compiler-jvm",
    "ceylon-js": "compiler-js",
    "ceylon-spec": "typechecker",
    "ceylon-model": "model",
    "ceylon-common": "common",
    "ceylon-module-resolver": "cmr",
    "ceylon-runtime": "runtime",
    "ceylon.language": "language",
    "ceylon-dist": "dist"
};
 
function forAll(list, func, onEnd) {
    if (list.constructor.name == "List") {
        var items = [];
        list.each({
            func:  function(item) {
                items.push(item);
            },
            finish: function() {
                var keys = Object.keys(items);
                _forAll(keys, items, func, onEnd);
            }
        });
    } else {
        var keys = Object.keys(list);
        _forAll(keys, list, func, onEnd);
    }
}

function forAllSorted(list, func, onEnd) {
    var keys = Object.keys(list);
    keys.sort();
    _forAll(keys, list, func, onEnd);
}

function _forAll(keys, list, func, onEnd) {
    function call(i) {
        if (i < keys.length) {
            func(keys[i], list[keys[i]], function() {
                call(i+1);
            });
        } else if (onEnd != null) {
            onEnd();
        }
    }
    call(0);
}

function forAllProjects(func, onEnd) {
    forAll(repos, func, onEnd);
}

//******************************************************
// Labels
//******************************************************

function fetchLabels(repo, newname, onEnd) {
    var lst = github.labels("ceylon", repo);
    $("#labels").append("<li>" + repo + "</li>");
    var r = $("<ul/>");
    r.appendTo("#labels");
    
    function onItem(item) {
        var nm = item.data.name.toLowerCase();
        var color = item.data.color;
        var cnt = labelcounts[nm] || 0;
        labelcounts[nm] = cnt + 1;
        labelcolors[nm] = color;
        r.append('<li><span style="background-color:#' + color + '; color:white">' + item.data.name + '</span></li>');
    }
    
    lst.each({
        func: onItem,
        finish: onEnd
    });
}

function showLabelsOverview() {
    var keys = Object.keys(labelcounts);
    keys.sort();
    for (i=0; i<keys.length; i++) {
        var name = keys[i];
        var cnt = labelcounts[name];
        var color = labelcolors[name];
        $("#overview").append('<li><span style="background-color:#' + color + '; color:white">' + name + '</span> (' + cnt + ')</li>');
    }
    $("#overview").append('<br><button onclick="deleteLabels()">Delete Labels</button><br>');
    $("#overview").append('<br><button onclick="createLabels()">Create Labels</button><br>');
}

function fetchAllLabels() {
    labelcounts = {};
    labelcolors = {};
    $("#labels").empty();
    $("#overview").empty();
    $("#deleting").empty();
    $("#creating").empty();
    forAllProjects(function(repo, newname, onEnd) {
        fetchLabels(repo, newname, onEnd);
    }, function() {
        // We add a bunch of new labels for each of the repositories
        // so we can later mark each issue with the repository it came from
        $.each(repos, function(repo, newname) {
            labelcounts["c-" + newname] = 1;
            labelcolors["c-" + newname] = "00aa00";
        });
        showLabelsOverview();
    });
}

function deleteLabels() {
    $("#deleting").empty();
    var lst = github.labels("ceylon", "ceylon-obr-test");
    forAll(lst, function(key, item, onEnd) {
        $("#deleting").append("<li>Deleting '" + item.data.name + "'</li>");
        item.remove({
            success: onEnd
        });
    });
}

function createLabels() {
    $("#creating").empty();
    forAllSorted(labelcolors, function(name, color, onEnd) {
        $("#creating").append("<li>Creating '" + name + "' with color #" + color + "</li>");
        github.createLabel("ceylon", "ceylon-obr-test", {
            data: {
                name: name,
                color: color
            },
            success: onEnd
        });
    }, function() {
        $("#creating").append("<li>Done</li>");
    });
}

//******************************************************
// Milestones
//******************************************************

function fetchMilestones(repo, newname, onEnd) {
    var lst = github.milestones("ceylon", repo, {parameters:{state:"all"}});
    $("#milestones").append("<li>" + repo + "</li>");
    var r = $("<ul/>");
    r.appendTo("#milestones");
    
    function onItem(item) {
        var nm = item.data.title.toLowerCase();
        var cnt = mstonecounts[nm] || 0;
        var data = mstonedata[nm] || {};
        data.title = nm;
        data.state = data.state || item.data.state;
        data.due_on = data.due_on || item.data.due_on;
        mstonecounts[nm] = cnt + 1;
        mstonedata[nm] = data;
        r.append('<li><b>' + item.data.title + '</b> ' + item.data.state + ' ' + item.data.due_on + '</li>');
    }
    
    lst.each({
        func: onItem,
        finish: onEnd
    });
}

function showMilestonesOverview() {
    var keys = Object.keys(mstonecounts);
    keys.sort();
    for (i=0; i<keys.length; i++) {
        var name = keys[i];
        var cnt = mstonecounts[name];
        $("#overview").append('<li>' + name + ' (' + cnt + ')</li>');
    }
    $("#overview").append('<br><button onclick="deleteMilestones()">Delete Milestones</button><br>');
    $("#overview").append('<br><button onclick="createMilestones()">Create Milestones</button><br>');
}

function fetchAllMilestones() {
    mstonecounts = {};
    mstonedata = {};
    $("#milestones").empty();
    $("#overview").empty();
    $("#deleting").empty();
    $("#creating").empty();
    forAllProjects(function(repo, newname, onEnd) {
        fetchMilestones(repo, newname, onEnd);
    }, function() {
        showMilestonesOverview();
    });
}

function deleteMilestones() {
    $("#deleting").empty();
    var lst = github.milestones("ceylon", "ceylon-obr-test", {parameters:{state:"all"}});
    forAll(lst, function(key, item, onEnd) {
        $("#deleting").append("<li>Deleting '" + item.data.title + "'</li>");
        item.remove({
            success: onEnd
        });
    });
}

function createMilestones() {
    $("#creating").empty();
    forAllSorted(mstonedata, function(name, data, onEnd) {
        $("#creating").append('<li>Creating <b>' + data.title + '</b> ' + data.state + ' ' + data.due_on + '</li>');
        github.createMilestone("ceylon", "ceylon-obr-test", {
            data: data,
            success: onEnd
        });
    }, function() {
        $("#creating").append("<li>Done</li>");
    });
}

//******************************************************
// Issues
//******************************************************

function fetchMilestonesForMap(repo, newname, onEnd) {
    var lst = github.milestones("ceylon", repo, {parameters:{state:"all"}});
    
    function onItem(item) {
        var nm = item.data.title.toLowerCase();
        if (repo == "ceylon-obr-test") {
            mstonemap[nm] = item.data.number;
        } else {
            mstonemap[repo + "-" + item.data.number] = mstonemap[nm];
        }
    }
    
    lst.each({
        func: onItem,
        finish: onEnd
    });
}

function createMilestoneMap() {
    mstonemap = {};
    repos2 = {
        "ceylon-obr-test": "obrtest"
    }
    $.each(repos, function(repo, newname) {
        repos2[repo] = newname;
    });
    forAll(repos2, function(repo, newname, onEnd) {
        $("#mstones").append('<li>' + repo + '</li>');
        fetchMilestonesForMap(repo, newname, onEnd);
    }, function() {
        $("#mstones").append('<p>Map:</p>');
        $.each(mstonemap, function(title, number) {
            $("#mstones").append('<li>' + title + ' -&gt; ' + number + '</li>');
        });
        $("#issues").append('<button onclick="fetchAllIssues()">Fetch Issues</button>');
    });
}

function fetchIssues(repo, newname, onEnd) {
    var lst = github.repositoryIssues("ceylon", repo, {parameters:{state:"all", sort:"created", direction:"asc"}});
    $("#issues").append("<li>" + repo + "</li>");
    var r = $('<ul/>');
    r.appendTo("#issues");
    var cnt = 0;
    issueoffsets[repo] = offsetcnt;
    
    function onItem(item) {
        cnt++;
        offsetcnt++;
        var issue = {}
        issue.title = item.data.title;
        issue.body = "[@" + item.data.user.login + "] " + item.data.body;
        issue.created_at = item.data.created_at;
        if (item.data.assignee != null) {
            issue.assignee = item.data.assignee.login;
        }
        if (item.data.milestone) {
            issue.milestone = mstonemap[repo + "-" + item.data.milestone.number];
        }
        issue.closed = item.data.state == "closed";
        issue.labels = labels(item.data.labels);
        issue.labels.push("c-" + newname);
        issue.org_number = item.data.number;
        issue.org_repo = repo;
        if (issue.closed) {
            if (item.data.closed_by) {
                issue.org_closee = item.data.closed_by.login;
            }
            issue.org_closed_at = item.data.closed_at;
        }
        var comments = [];
        var data = {
            issue: issue,
            comments: comments
        };
        var issueid = newname + "-" + item.data.number;
        issues[issueid] = data;
        r.html('<li>Issues: ' + cnt + '</li>');
    }
    
    lst.each({
        func: onItem,
        finish: function() {
            fetchComments(repo, newname, onEnd);
        }
    });
}

function labels(issuelabels) {
    var labels = [];
    $.each(issuelabels, function(idx, lbl) {
        labels.push(lbl.name.toLowerCase());
    });
    return labels;
}

function fetchComments(repo, newname, onEnd) {
    var lst = github.repositoryComments("ceylon", repo, {parameters:{sort:"created", direction:"asc"}});
    var r = $('<ul/>');
    r.appendTo("#issues");
    var cnt = 0;
    
    function onItem(item) {
        cnt++;
        var data = {};
        var usertag = "[@" + item.data.user.login + "]";
        var body = item.data.body;
        if (/^\s*[^a-zA-Z\s].*(\r)\n/.test(body)) {
            body = usertag + "\n" + body;
        } else {
            body = usertag + " " + body;
        }
        data.body = body;
        data.created_at = item.data.created_at;
        var issueurl = item.data.issue_url;
        var p = issueurl.indexOf("/issues/");
        var id = issueurl.substring(p + 8);
        var issueid = newname + "-" + id;
        var issue = issues[issueid];
        issue.comments.push(data);
        r.html('<li>Comments: ' + cnt + '</li>');
    }
    
    lst.each({
        func: onItem,
        finish: onEnd
    });
}

function showIssuesOverview() {
    $.each(repos, function(repo, newname) {
        $("#overview").append("<li>" + repo + ": " + issueoffsets[repo] + "</li>");
    });
    $("#overview").append("<li>Total issue count: " + Object.keys(issues).length + "</li>");
    $("#overview").append('<br><button onclick="createIssues()">Create Issues</button><br>');
}

function fetchAllIssues() {
    issues = {};
    issueoffsets = {};
    offsetcnt = 0;
    $("#issues").empty();
    $("#overview").empty();
    $("#creating").empty();
    forAllProjects(function(repo, newname, onEnd) {
        fetchIssues(repo, newname, onEnd);
    }, function() {
        showIssuesOverview();
    });
}

function createIssues() {
    issueidx = 0;
    forAll(issues, createIssue, allDone);
}

function createIssueOrWait(issueid, issue, onEnd) {
    if (github.rateLimitRemaining > 30) {
        createIssue(issueid, issue, onEnd);
    } else {
        waitForRateLimit(function() {
            createIssueOrWait(issueid, issue, onEnd);
        });
    }
}

function waitForRateLimit(onEnd) {
    function handleLimit(json, status, xhr) {
        if (github.rateLimitRemaining <= 30) {
            var reset = parseInt(json.resources.core.reset) * 1000;
            var wait = reset - (new Date()).getMilliseconds();
            $("#waiting").text("Waiting " + wait/60000 + " minutes until " + (new Date(reset)));
            setTimeout(function() {
                $("#waiting").text("");
                waitForRateLimit(onEnd);
            }, wait);
        } else {
            onEnd();
        }
    }
    github.rateLimit({success:handleLimit, error:handleError})
}

function createIssue(issueid, issue, onEnd) {
    issueidx++;

    if (issue.created_ok === true) {
        onEnd();
        return;
    }
    
    function handleImport(json, status, xhr) {
        issue.created_ok = true;
        $("#creating").text("Created " + issueidx + " of " + Object.keys(issues).length + " status: " + json.status);
        if (json.status == "pending") {
            checkImport(json, onEnd);
        } else if (json.status == "imported") {
            onEnd();
        } else {
            handleError(xhr, -1, "handleImport - status");
        }
    }
    
    var body = issue.issue.body;
    body = convertIssueLinks(body, issue.issue.org_repo, issueoffsets);
    if (!body.endsWith("\n")) {
        body = body + "\n";
    }
    body = body + "\n[Migrated from " + escapeRefs("ceylon/" + issue.issue.org_repo + "#" + issue.issue.org_number) + "]";
    if (issue.issue.closed == true) {
        if (issue.issue.org_closee != null) {
            body = body + "\n[Closed by @" + issue.issue.org_closee + " at " + stripDate(issue.issue.org_closed_at) + "]";
        } else {
            body = body + "\n[Closed at " + stripDate(issue.issue.org_closed_at) + "]";
        }
    }

    var newissue = {
        issue: {
            title: issue.issue.title,
            body: body,
            created_at: issue.issue.created_at,
            assignee: issue.issue.assignee,
            milestone: issue.issue.milestone,
            closed: issue.issue.closed,
            labels: issue.issue.labels
        },
        comments: []
    };

    $.each(issue.comments, function(idx, comment) {
        var body = comment.body;
        body = convertIssueLinks(body, issue.issue.org_repo, issueoffsets);
        var newcomment = {
            created_at: comment.created_at,
            body: body
        }
        newissue.comments.push(newcomment);
    });
    
    console.log(issueidx, newissue);
    github.importIssue("ceylon", "ceylon-obr-test", {data: newissue, success: handleImport, error: handleError});
}

function stripDate(dt) {
    return dt.replace(/T/g, " ").replace(/Z/g, "");
}

function checkImport(json, onEnd) {
    function handleStatus(json, status, xhr) {
        $("#waiting").text("");
        $("#creating").text("Created " + issueidx + " of " + Object.keys(issues).length + " status: " + json.status);
        if (json.status == "pending") {
            checkImport(json, onEnd);
        } else if (json.status == "imported") {
            setTimeout(onEnd, 2000);
        } else {
            handleError(xhr, -1, "checkImport - status");
        }
    }
    
    $("#waiting").text("Waiting...");
    setTimeout(function() {
        $("#waiting").text("Checking...");
        github.importStatus("ceylon", "ceylon-obr-test", {data: json, success: handleStatus, error: handleError});
    }, 2000);
}

function handleError(xhr, status, err) {
    $("#waiting").text("");
    $("#creating").append("<br><b>FAILED</b>");
    console.log(xhr, status, err);
}

function allDone() {
    $("#waiting").text("");
    $("#creating").append("<br><b>DONE!!! HURRAY!!!</b>");
}

function convertIssueLinks(text, repo, repoIssuesMap){
    var shortRe = /(^|\W)#(\d+)($|\W)/mg;
    var longRe = /\b(https\:\/\/github\.com\/)?ceylon\/([\w.-]+)(#|\/issues\/)(\d+)/mg;
    var newText = "";
    var position = 0;
    var i=0;
    while(true){
        if(i++ == 10)
            break;
        shortRe.lastIndex = position;
        var shortMatch = shortRe.exec(text);
        longRe.lastIndex = position;
        var longMatch = longRe.exec(text);
        if(shortMatch == null){
            if(longMatch == null)
                break;
            // use long match
            newText += text.substring(position, longMatch.index);
            position = longRe.lastIndex;
            var issueOrg = "ceylon";
            var issueRepo = longMatch[2];
            var issueNumber = longMatch[4];
            newText += convertIssue(issueOrg, issueRepo, issueNumber, repoIssuesMap);
        }else{
            if(longMatch == null || longMatch.index > shortMatch.index){
                // use short match
                newText += text.substring(position, shortMatch.index);
                position = shortRe.lastIndex;
                var issueNumber = shortMatch[2];
                issueNumber = offsetIssue("ceylon", repo, issueNumber, repoIssuesMap);
                newText += shortMatch[1] + "#" + issueNumber + shortMatch[3];
            }else{
                // use longMatch
                newText += text.substring(position, longMatch.index);
                position = longRe.lastIndex;
                var issueOrg = "ceylon";
                var issueRepo = longMatch[2];
                var issueNumber = longMatch[4];
                newText += convertIssue(issueOrg, issueRepo, issueNumber, repoIssuesMap);
            }
        }
    }
    newText += text.substring(position);
    return newText;
}

function offsetIssue(issueOrg, issueRepo, issueNumber, repoIssuesMap){
    if(issueOrg === "ceylon"){
        var offset = repoIssuesMap[issueRepo];
        if(offset != null){
            return parseInt(issueNumber) + offset;
        }
    }
    return issueNumber;
}

function convertIssue(issueOrg, issueRepo, issueNumber, repoIssuesMap){
    if(issueOrg === "ceylon"){
        var offset = repoIssuesMap[issueRepo];
        if(offset != null){
            var newIssue = parseInt(issueNumber) + offset;
            return "#" + newIssue;
        }
    }
    return escapeRefs(issueOrg + "/" + issueRepo + "#" + issueNumber);
}

function escapeRefs(ref) {
    if (!dont_escape_refs) {
        return "`" + ref + "`";
    } else {
        return ref;
    }
}
