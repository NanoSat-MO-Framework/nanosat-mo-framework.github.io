/**
	This file should contain only deployment specific configuration.
*/

var NMF_REPO     = "esa/nanosat-mo-framework";
var NMF_XML_PATH = "core/mo-services-xml/src/main/resources/xml";
var GH_API       = "https://api.github.com/repos/" + NMF_REPO;
var GH_RAW       = "https://raw.githubusercontent.com/" + NMF_REPO;

// Branch shown by default on page load
var configActiveBranch = "master";

// Populated dynamically — do not edit by hand
var configServiceDefFiles = [];

var configServiceBookFiles = {
	"MAL": {pdfFilePath:		"pdf/ServiceDefMAL.xml-521x0b2e1.pdf",		name:"521x0b2e1", icon:"book"},
	"COM": {pdfFilePath:		"pdf/ServiceDefCOM.xml-521x1b1.pdf", 			name:"521x1b1", 	icon:"book"},
	"Common": {pdfFilePath:	"pdf/ServiceDefCommon.xml-522x0r1.pdf",		name:"522x0r1 (draft)", 	icon:"book_red"},
	"MC": {pdfFilePath:			"pdf/ServiceDefMC.xml-522x1b1.pdf", 			name:"522x1b1",		icon:"book"},
}
