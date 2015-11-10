#!/usr/bin/perl -w

# Replaces links to issue numbers found in the input stream
# with new links that point the the renumbered issues

use feature qw(switch);
no warnings 'experimental::smartmatch';

$defproject = $ARGV[0];

sub offset {
    $projname = $_[0] || $defproject;
    $issuenum = $_[1];

    $issue = "";
    given($projname) {
        when(["compiler", "compiler-java"]) { $issue = "#" . ($issuenum + 0); }
        when(["js", "compiler-js"]) { $issue = "#" . ($issuenum + 2418); }
        when(["spec", "typechecker"]) { $issue = "#" . ($issuenum + 3088); }
        when("model") {  $issue = "#" . ($issuenum + 4552); }
        when("common") { $issue = "#" . ($issuenum + 4571); }
        when("module-resolver" || "cmr") { $issue = "#" . ($issuenum + 4635); }
        when("runtime") { $issue = "#" . ($issuenum + 4767); }
        when("language") {  $issue = "#" . ($issuenum + 4850); }
        when("dist") {  $issue = "#" . ($issuenum + 5641); }
    }

    return $issue;
}

while (<STDIN>) {
    s/(((https\:\/\/github\.com\/)?ceylon\/ceylon[.-]([a-z]+))?(#|\/issues\/)([0-9]+))/offset($4,$6)/ge;
    print $_;
}

# Force SHA1s to be different
#print "\n";

