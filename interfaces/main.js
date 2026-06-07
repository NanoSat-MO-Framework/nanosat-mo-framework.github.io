function hasChildTag(xml_node, tag) {
	for (var i = 0; i < xml_node.childNodes.length; i++) {
		if (xml_node.childNodes[i].tagName === tag) return true;
	}
	return false;
}

// Recursively generate a jsTree node structure from a given XML node
function mo_parse(xml_node, lvl, parent_tree_node) {
	lvl = lvl || 0
	parent_tree_node = parent_tree_node || null
	// String.prototype.repeat() is not used below for IE compatibility
	var prfx = "";
	while (lvl-- > 0) {
		prfx += ". "
	}

	// mal:diagram — create a single "Diagram" leaf node and skip SVG children
	if (xml_node.tagName === "mal:diagram" && parent_tree_node !== null) {
		var diagram_tree_node = {
			"text": "Diagram",
			"children": [],
			"icon": iconPath("mal:diagram"),
			"id": parent_tree_node.id + "_Diagram",
			"data": {
				"path": parent_tree_node.data.path + "/Diagram",
				"xml_node": xml_node
			}
		}
		parent_tree_node.children.push(diagram_tree_node)
		tree.nodePathMap[diagram_tree_node.data.path] = diagram_tree_node
		return
	}

	// skip ommited node types
	// Array.prototype.includes() is not used below for IE compatibility
	var _omit = OMMITED_NODE_TYPES.indexOf(xml_node.tagName) !== -1 ||
		(xml_node.tagName === "mal:errors" && xml_node.parentNode && xml_node.parentNode.tagName !== "mal:area") ||
		(xml_node.tagName === "com:events" && !hasChildTag(xml_node, "com:event")) ||
		(xml_node.tagName === "com:objects" && !hasChildTag(xml_node, "com:object"));
	if (!_omit) {
		var display_name = treeElementName(xml_node)
		var new_tree_node = {
			"text": display_name,
			"children": [],
			"icon": xml_node.tagName === "mal:area" ? false : iconPath(xml_node.tagName),
			"id": parent_tree_node == null ? display_name : (parent_tree_node.id + "_" + display_name),
			"data": {
				"path": parent_tree_node == null ? display_name : (parent_tree_node.data.path + "/" + display_name),
				"xml_node": xml_node
			}
		}

		//if it's a root element, i.e. a book
		if (parent_tree_node == null) {
			tree.data.push(new_tree_node)

			if (navigator.appName == 'Microsoft Internet Explorer' ||  !!(navigator.userAgent.match(/Trident/) || navigator.userAgent.match(/rv:11/)) || (typeof $.browser !== "undefined" && $.browser.msie == 1))
			{
				//IE is not supported				
			}else
			{
				//if the book is available as a PDF file
				if(configServiceBookFiles[new_tree_node.text]){
					// then create a book entry
					var pdf = configServiceBookFiles[new_tree_node.text]
					console.info(new_tree_node.text);
					var pdf_tree_node = {
						"text": pdf.name,
						"children": [],
						"icon": iconPath(pdf.icon),
						"id": new_tree_node.id + "_" + display_name,
						"data": {
							"path": parent_tree_node == null ? display_name : new_tree_node.data.path + "/" + display_name,
							//creates a fake XML node
							"xml_node": {
								tagName:"book",
								pdfInfo: pdf
							}
						}
					}
					new_tree_node.children.push(pdf_tree_node)
				}
			}
		} else {
			parent_tree_node.children.push(new_tree_node)
		}

		xml_node.tree_node = new_tree_node // link the XML tree node to jsTree node
		tree.nameMap[name] = new_tree_node
		tree.nodePathMap[new_tree_node.data.path] = new_tree_node

		parent_tree_node = new_tree_node
	}

	// Cannot iterate over Element.children for IE compatibility
	for (var i = 0; i < xml_node.childNodes.length; ++i) {
		var child = xml_node.childNodes[i]
		if (child instanceof Element) {
			// Populate Area and Service members and propagate them recursively
			if (child.isTag("mal:area")) {
				child.area = child.getAttribute("name")
			}
			child.area = child.area || child.parentNode.area

			if (child.isTag("mal:service")) {
				child.service = child.getAttribute("name")
			}
			child.service = child.service || child.parentNode.service

			mo_parse(child, lvl + 1, parent_tree_node)
		}
	}
}

function processXMLFile(filepath) {
	// console.info("loading " + filepath);
	jQuery.ajaxSetup({ async: false });

	$.get(filepath, function (d) {
		mo_parse(d.documentElement)
	}, "xml")
}

function loadMoSpecs() {
	for (var key in configServiceDefFiles) {
		processXMLFile(configServiceDefFiles[key]);
	}
}

function selectNodeFromURL() {
	var nodePath = getUrlParameter("u");
	if (typeof nodePath !== "undefined") {
		selectNodeFromPath(nodePath);
	}
}

function selectNodeFromPath(p_node_path) {
	var tmp_node = tree.nodePathMap[p_node_path];
	if (tmp_node != null) {
		$("#div_tree").jstree("deselect_all");
		$("#div_tree").jstree("select_node", tmp_node.id);
		$("#div_tree").jstree("open_node", tmp_node.id);
	}
}

function onHoverHandler(event, data) {
	hoverInToMiniview(data.node.data.xml_node, $("#" + data.node.a_attr.id))
}

function onDehoverHandler(event, data) {
	hoverOutOfMiniview(data.node.data.xml_node, $("#" + data.node.a_attr.id))
}

function onSelectHandler(event, data) {
	$("#div_tree").jstree("toggle_node", data.node.id)
	onNodeSelect(data.node)
}

function initTree() {
	tree = {}
	tree.nodePathMap = []
	tree.nameMap = {}
	tree.data = []
	loadMoSpecs();

	if ($.jstree.reference("#div_tree")) {
		$("#div_tree").jstree("destroy");
	}

	$("#div_tree").jstree({
		"core": {
			"multiple": false,
			"animation": false,
			"data": tree.data,
			"themes": { "dots": false }
		},
		"search": {
			"fuzzy": false,
			"show_only_matches": true,
			"show_only_matches_children": true
		},
		"plugins": ["search"]
	});

	// jstree("destroy") calls off('.jstree') on the element, removing these
	// handlers — so rebind them every time after a new instance is created.
	$("#div_tree").on("ready.jstree", function () {
		selectNodeFromURL();
	});
	$("#div_tree").on("select_node.jstree", onSelectHandler);
}

function fetchBranches(callback) {
	$.getJSON(GH_API + "/branches?per_page=100", function (branches) {
		var select = $("#branchSelect");
		select.empty();
		branches.forEach(function (b) {
			select.append($("<option>").val(b.name).text(b.name));
		});
		var urlBranch = getUrlParameter("branch");
		var target = urlBranch || configActiveBranch;
		if (select.find("option[value='" + target + "']").length) {
			select.val(target);
		} else {
			select.val(branches[0].name);
		}
		if (callback) callback(select.val());
	}).fail(function () {
		console.error("Could not fetch branch list from GitHub API.");
		var select = $("#branchSelect");
		select.empty();
		select.append($("<option>").val(configActiveBranch).text(configActiveBranch));
		if (callback) callback(configActiveBranch);
	});
}

function loadBranch(branch) {
	$("#div_tree").html("<p style='padding:10px;color:#6c757d;font-size:0.85em'>Loading&hellip;</p>");
	$.getJSON(GH_API + "/contents/" + NMF_XML_PATH + "?ref=" + encodeURIComponent(branch), function (files) {
		configServiceDefFiles = files
			.filter(function (f) { return f.name.endsWith(".xml"); })
			.map(function (f) { return GH_RAW + "/" + branch + "/" + NMF_XML_PATH + "/" + f.name; });
		document.getElementById("div_main").innerHTML = "";
		initTree();
	}).fail(function () {
		$("#div_tree").html("<p style='padding:10px;color:#dc3545;font-size:0.85em'>No XML files found for branch <strong>" + branch + "</strong>.</p>");
	});
}

window.onload = function () {
	div_tree = document.getElementById('div_tree');
	div_main = document.getElementById('div_main');

	// Event handlers are bound inside initTree() so they survive branch switches.

	function updateGithubLink(branch) {
		var url = "https://github.com/" + NMF_REPO + "/tree/" + encodeURIComponent(branch) + "/" + NMF_XML_PATH;
		document.getElementById("github-link").href = url;
	}

	fetchBranches(function (defaultBranch) {
		updateGithubLink(defaultBranch);
		loadBranch(defaultBranch);
	});

	$("#branchSelect").on("change", function () {
		var branch = $(this).val();
		var nodePath = getUrlParameter("u");
		var newUrl = "?branch=" + encodeURIComponent(branch) + (nodePath ? "&u=" + nodePath : "");
		history.pushState({}, branch, newUrl);
		updateGithubLink(branch);
		loadBranch(branch);
	});

	$("#searchbox").on('input', function (e) {
		$("#div_tree").jstree(true).search($("#searchbox").val());
	});
}

$(window).on("popstate", function (e) {
	var branchParam = getUrlParameter("branch");
	var currentBranch = $("#branchSelect").val();
	if (branchParam && branchParam !== currentBranch) {
		$("#branchSelect").val(branchParam);
		loadBranch(branchParam);
		// selectNodeFromURL() will be called by the ready.jstree handler after reload
	} else {
		selectNodeFromURL();
	}
})
