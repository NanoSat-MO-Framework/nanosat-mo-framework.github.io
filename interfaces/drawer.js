function d_mal_fundamental(node, target_div) {
	target_div = target_div || div_main
	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");

	// Name
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Name"))
	row.appendChild(td_with_text(node.getAttribute("name"), 3))
	tblBody.appendChild(row)

	// Extends
	row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Extends"))
	if (node.childrenByTag("mal:extends")) {
		var super_type = node.childrenByTag("mal:extends")[0]// there only
		// one entry in
		// extends
		row.appendChild(td_with_text(str_mal_node_type(super_type), 3))
	} else {
		row.appendChild(td_with_text("", 3))
	}
	tblBody.appendChild(row)

	// Fundamentals are always abstract
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Abstract", 4))
	tblBody.appendChild(row)

	tbl.appendChild(tblBody);
	target_div.appendChild(tbl);
}

function d_mal_attribute(node, target_div) {
	target_div = target_div || div_main
	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");

	// Name
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Name"))
	row.appendChild(td_with_text(node.getAttribute("name"), 3))
	tblBody.appendChild(row)

	// Extends
	row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Extends"))
	row.appendChild(td_with_text(create_type_annotation("Attribute", "MAL/Data/Attribute", null), 3))
	tblBody.appendChild(row)

	// short form part
	if (node.getAttribute("shortFormPart")) {
		var row = document.createElement("tr");
		row.appendChild(blue_td_with_text("Short Form Part"))
		row.appendChild(td_with_text(node.getAttribute("shortFormPart"), 3))
		tblBody.appendChild(row)
	}

	tbl.appendChild(tblBody);
	target_div.appendChild(tbl);
}

function d_mal_composite(node, target_div) {
	target_div = target_div || div_main
	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");

	// Name
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Name"))
	row.appendChild(td_with_text(node.getAttribute("name"), 3))
	tblBody.appendChild(row)

	// Extends
	row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Extends"))
	if (node.childrenByTag("mal:extends")) {
		var super_type = node.childrenByTag("mal:extends")[0]// there only
		// one entry in
		// extends
		row.appendChild(td_with_text(str_mal_node_type(super_type), 3))
	} else {
		row.appendChild(td_with_text("MAL:Composite", 3))
	}
	tblBody.appendChild(row)

	// short form part
	if (node.getAttribute("shortFormPart")) {
		var row = document.createElement("tr");
		row.appendChild(blue_td_with_text("Short Form Part"))
		row.appendChild(td_with_text(node.getAttribute("shortFormPart"), 3))
		tblBody.appendChild(row)
	} else {
		// Abstract
		var row = document.createElement("tr");
		row.appendChild(blue_td_with_text("Abstract", 4))
		tblBody.appendChild(row)
	}

	// fields
	if (node.childrenByTag("mal:field")) {
		var header_row = tableRow(["Field", "Type", "Nullable", "Comment"]);
		header_row.setAttribute("class", "blue_bg");
		tblBody.appendChild(header_row)

		node.childrenByTag("mal:field").map(
			function (f) {
				row = document.createElement("tr");
				row.appendChild(td_with_text(f.getAttribute("name")))
				row.appendChild(td_with_text(str_mal_node_type(f)))
				row.appendChild(td_with_text(f.getAttribute("canBeNull") == "true"
					|| f.getAttribute("canBeNull") == null ? "Yes" : "No"))
				var tdl = td_with_text(f.getAttribute("comment"));
				tdl.style.textAlign = "left";
				row.appendChild(tdl)
				tblBody.appendChild(row)
			})
	}

	tbl.appendChild(tblBody);
	target_div.appendChild(tbl);
}

function d_mal_ip(node, target_div) {
	target_div = target_div || div_main

	var h2 = document.createElement("h2")
	h2.innerHTML = "Overview"
	target_div.appendChild(h2)

	var comment = node.getAttribute("comment")
	if (comment && comment !== "") {
		var p = document.createElement("p")
		p.innerHTML = format_line_breaks(comment)
		target_div.appendChild(p)
	}

	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");

	d_mal_ip_header(tblBody, node.getAttribute("name"), LONG_NAMES[node.tagName])

	// For PUB-SUB: add Subscription Keys row between the header and the message table
	if (node.tagName === "mal:pubsubIP") {
		node.eachTag("mal:messages", function (msg) {
			var subKeyEl = msg.childrenByTag("mal:subscriptionKeys")
			if (!subKeyEl || subKeyEl.length === 0) return
			subKeyEl = subKeyEl[0]
			var fields = subKeyEl.childrenByTag("mal:field") || []

			var skTd = document.createElement("td")
			skTd.setAttribute("colspan", 3)

			fields.forEach(function (f, i) {
				var typeEl = f.childrenByTag("mal:type")
				var typeName = (typeEl && typeEl.length > 0) ? typeEl[0].getAttribute("name") : ""
				var fieldName = f.getAttribute("name")
				var fieldKey = "mal:subscriptionKeys_" + fieldName

				if (i > 0) skTd.appendChild(document.createElement("br"))

				var typeSpan = document.createElement("span")
				typeSpan.innerHTML = str_mal_node_type(f)
				typeSpan.appendChild(document.createTextNode(" "))
				var typeA = typeSpan.querySelector("a")
				if (typeA) {
					typeA.addEventListener("mouseover", function () {
						document.querySelectorAll('[data-tsd-field="' + fieldKey + '"]').forEach(function (el) {
							el.classList.add("field-highlight")
						})
					})
					typeA.addEventListener("mouseout", function () {
						document.querySelectorAll('[data-tsd-field="' + fieldKey + '"]').forEach(function (el) {
							el.classList.remove("field-highlight")
						})
					})
				}
				skTd.appendChild(typeSpan)

				var nameElem = document.createElement("a")
				nameElem.innerHTML = fieldName
				nameElem.setAttribute("data-field-key", fieldKey)
				nameElem.style.cursor = "default"
				nameElem.addEventListener("mouseover", function () {
					var key = this.getAttribute("data-field-key")
					document.querySelectorAll('[data-tsd-field="' + key + '"]').forEach(function (el) {
						el.classList.add("field-highlight")
					})
				})
				nameElem.addEventListener("mouseout", function () {
					var key = this.getAttribute("data-field-key")
					document.querySelectorAll('[data-tsd-field="' + key + '"]').forEach(function (el) {
						el.classList.remove("field-highlight")
					})
				})
				skTd.appendChild(nameElem)
			})

			var skRow = document.createElement("tr")
			skRow.appendChild(blue_td_with_text("Subscription Keys"))
			skRow.appendChild(skTd)
			tblBody.appendChild(skRow)
		})
	}

	// Body header
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Pattern Sequence"))
	row.appendChild(blue_td_with_text("Message"))
	row.appendChild(blue_td_with_text("Nullable"))
	row.appendChild(blue_td_with_text("Type Signature"))
	tblBody.appendChild(row)

	// messages — skip subscriptionKeys (shown in header row above)
	node.eachTag("mal:messages", function (msg) {
		var msgChildren = $(msg).children().toArray()
		msgChildren.forEach(function (child) {
			if (child.tagName !== "mal:subscriptionKeys") {
				tblBody.appendChild(tr_mal_message(child))
			}
		})
	})

	tbl.appendChild(tblBody);
	target_div.appendChild(tbl);

	draw_type_signature_details(node, target_div);

	// draw_errors(node,target_div)
	// draw_comments(node,target_div)
}

function draw_type_signature_details(node, target_div) {
	target_div = target_div || div_main

	var messagesNodes = node.childrenByTag("mal:messages")
	if (!messagesNodes || messagesNodes.length === 0) return

	var msgNode = messagesNodes[0]
	var msgChildren = $(msgNode).children().toArray()

	var msgsWithFields = msgChildren.filter(function (msg) {
		var fields = msg.childrenByTag("mal:field")
		return fields && fields.length > 0
	})

	if (msgsWithFields.length === 0) return

	var h2 = document.createElement("h2")
	h2.innerHTML = "Type Signature Details"
	target_div.appendChild(h2)

	msgsWithFields.forEach(function (msg) {
		var fields = msg.childrenByTag("mal:field")

		var ul = document.createElement("ul")
		ul.style.listStyleType = "disc"
		ul.style.paddingLeft = "20px"
		ul.style.margin = "4px 0"

		fields.forEach(function (f) {
			var li = document.createElement("li")
			var name = f.getAttribute("name")
			var comment = f.getAttribute("comment")
			li.setAttribute("data-tsd-field", msg.tagName + "_" + name)
			li.innerHTML = "<b>" + name + "</b>"
			if (comment && comment !== "") {
				li.innerHTML += " - " + comment
			}
			ul.appendChild(li)
		})

		target_div.appendChild(ul)
	})
}

function d_mal_ip_header(tblBody, id, ip) {
	// Operation identifier
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Operation Identifier"))
	row.appendChild(td_with_text(id, 3))
	tblBody.appendChild(row)

	// Interaction Pattern
	var row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Interaction Pattern"))
	row.appendChild(gray_td_with_text(ip, 3))
	tblBody.appendChild(row)
}

function tr_mal_message(node, target_div, unique_sufix) {
	target_div = target_div || div_main
	unique_sufix = unique_sufix || gen_suffix()

	var row = document.createElement("tr");
	var tag = node.tagName
	row.appendChild(gray_td_with_text(IN_OR_OUT[tag]))
	row.appendChild(gray_td_with_text(MESSAGE_NAMES[tag]))

	// Nullable column: one Yes/No per field based on canBeNull attribute
	var nullableValues = node.childrenByTag("mal:field").map(function (f) {
		return f.getAttribute("canBeNull") === "true" ? "Yes" : "No"
	})
	row.appendChild(gray_td_with_text(nullableValues.join("\n")))

	var td = td_with_text("")

	var ul = document.createElement("ul");

	// a field has a name and a type

	for (f in node.childrenByTag("mal:field")) {
		field = node.childrenByTag("mal:field")[f]

		var li = document.createElement("li");
		var fieldKey = node.tagName + "_" + field.getAttribute("name")
		li.innerHTML = str_mal_node_type(field)
		li.appendChild(document.createTextNode(" "))

		var typeA = li.querySelector("a")
		if (typeA) {
			typeA.addEventListener("mouseover", function () {
				document.querySelectorAll('[data-tsd-field="' + fieldKey + '"]').forEach(function (el) {
					el.classList.add("field-highlight")
				})
			})
			typeA.addEventListener("mouseout", function () {
				document.querySelectorAll('[data-tsd-field="' + fieldKey + '"]').forEach(function (el) {
					el.classList.remove("field-highlight")
				})
			})
		}

		var elem_name = document.createElement("a");
		elem_name.innerHTML = field.getAttribute("name")
		elem_name.setAttribute("data-field-key", fieldKey)
		elem_name.style.cursor = "default"

		elem_name.addEventListener("mouseover", function () {
			var key = this.getAttribute("data-field-key")
			document.querySelectorAll('[data-tsd-field="' + key + '"]').forEach(function (el) {
				el.classList.add("field-highlight")
			})
		})
		elem_name.addEventListener("mouseout", function () {
			var key = this.getAttribute("data-field-key")
			document.querySelectorAll('[data-tsd-field="' + key + '"]').forEach(function (el) {
				el.classList.remove("field-highlight")
			})
		})

		li.appendChild(elem_name)

		ul.appendChild(li)
	}

	// only a field not the type
	node.eachTag("mal:type", function (type) {
		var li = document.createElement("li");
		li.innerHTML = str_mal_type(type)
		ul.appendChild(li)

	})

	td.appendChild(ul)
	row.appendChild(td)

	return row
}

function d_mal_service(node, target_div) {
	target_div = target_div || div_main
	var area = node.parentNode

	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");

	// ------------------ first blue header ------------------
	var header_row = tableRow(SERVICE_HEADER);
	header_row.setAttribute("class", "blue_bg");
	tblBody.appendChild(header_row)

	out = node
	tblBody.appendChild(tableRow([//
		area.getAttribute("name"), // area identifier
		node.getAttribute("name"), // service identifier
		area.getAttribute("number"), // area number
		node.getAttribute("number"), // service number
		area.getAttribute("version") // area version
	]))

	// -------------------- second blue header ------------------
	var header_row = tableRow(OP_LIST_HEADER);
	header_row.setAttribute("class", "blue_bg");
	tblBody.appendChild(header_row)

	// ---------------------- operations -------------------------
	var operations = []
	// list of operations independently of capability set
	node.eachTag("mal:capabilitySet", function (cs) {
		var csChildren = $(cs).children();
		csChildren.each(function (idx) {
			var ip = csChildren[idx]
			if (typeof ip != 'undefined') {
				// updates list of all operations on parent node
				if (ip.tagName.match(/mal:.*IP/)) {
					// parent node is service
					operations.push($(ip))
				}
			}
		})
	})

	for (opi in operations) {
		op = operations[opi]

		var tRow = tableRow([//
			LONG_NAMES[op[0].tagName],//
			op[0].getAttribute("name"),//
			op[0].getAttribute("number"), // area
			op[0].getAttribute("supportInReplay"), op[0].parentNode.getAttribute("number")])

		// add link to the operation
		var operationCell = tRow.cells[1]

		operationCell.setAttribute("id", gen_suffix())
		operationCell.setAttribute("class", "link")

		// on hover of the cell, show mini view of the operation
		// on click, go there
		postDrawCell = function (node, cell) {
			return function () {
				var jqCell = $("#" + cell.getAttribute("id"))
				jqCell.click(function () {
					selectNodeFromPath(node.tree_node.data.path)
				})
			}
		}
		post_draw.push(postDrawCell(op[0], operationCell))
		tblBody.appendChild(tRow)
	}

	// merge capabilitySets
	// iterates throw the cells, if the capability set matches with the previous
	// then it deletes the cell and increments the row span of the previous
	var prevCapSetCell = null
	for (var r = 0, row; row = tblBody.rows[r]; r++) {
		var currCell = row.cells[4]

		// enters a new capability set
		if (!prevCapSetCell || prevCapSetCell.innerHTML != currCell.innerHTML) {
			prevCapSetCell = currCell
		} else {
			var prevSpan = prevCapSetCell.getAttribute("rowspan") || 1
			prevCapSetCell.setAttribute("rowspan", parseInt(prevSpan) + 1)
			row.deleteCell(4)
		}

	}

	// put the <tbody> in the <table>
	tbl.appendChild(tblBody);

	target_div.appendChild(tbl);

	var comment = node.getAttribute("comment")
	if (comment && comment !== "") {
		var h2 = document.createElement("h2")
		h2.innerHTML = "Overview"
		target_div.appendChild(h2)

		var p = document.createElement("p")
		p.innerHTML = format_line_breaks(comment)
		target_div.appendChild(p)
	}

}

function d_mal_enum(node, target_div) {
	target_div = target_div || div_main
	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");
	var row

	// name
	row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Name"))
	row.appendChild(td_with_text(node.getAttribute("name"), 2))
	tblBody.appendChild(row);
	// short form
	row = document.createElement("tr");
	row.appendChild(blue_td_with_text("Short Form Part"))
	row.appendChild(td_with_text(node.getAttribute("shortFormPart"), 2))
	tblBody.appendChild(row);

	var header_row = tableRow(ENUM_LIST_HEADER);
	header_row.setAttribute("class", "blue_bg");
	tblBody.appendChild(header_row)

	out = node

	for (it in node.childrenByTag("mal:item")) {
		item = node.childrenByTag("mal:item", it)
		row = document.createElement("tr");
		row.appendChild(td_with_text(item.getAttribute("value")))
		row.appendChild(td_with_text(item.getAttribute("nvalue")))
		row.appendChild(td_with_text(item.getAttribute("comment")))
		tblBody.appendChild(row);
	}

	// put the <tbody> in the <table>
	tbl.appendChild(tblBody);
	target_div.appendChild(tbl);
}

function d_com_events(node, target_div, object_tag) {
	object_tag = object_tag || "com:event"
	d_com_objects(node, target_div, object_tag);
}

function d_com_objects(node, target_div, object_tag) {
	object_tag = object_tag || "com:object"
	target_div = target_div || div_main

	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");
	var header_row = tableRow(COM_OBJECT_HEADER);
	header_row.setAttribute("class", "blue_bg");

	tblBody.appendChild(header_row)

	var row

	node.eachTag(object_tag, function (obj) {
		row = document.createElement("tr");
		row.appendChild(td_with_text(obj.getAttribute("name")))
		row.appendChild(td_with_text(obj.getAttribute("number")))

		// object body type
		var obj_body_type
		if (obj.childrenByTag("com:objectType")) {
			obj_body_type = str_mal_type(obj.childrenByTag("com:objectType")[0].childrenByTag("mal:type")[0])
		} else {
			obj_body_type = "No body"
		}
		row.appendChild(td_with_text(obj_body_type))

		// related & source
		var handle_obj_ref = function (typeTag) {
			//console.info(this)
			//console.info(typeTag)

			var refText
			if (this.childrenByTag(typeTag)) {
				var objType = this.childrenByTag(typeTag)[0].childrenByTag("com:objectType")
				// there is a defined type
				if (objType) {
					refText = str_com_type(objType[0])
				} else {
					refText = this.childrenByTag(typeTag)[0].getAttribute("comment")
				}
			} else {
				refText = "Set to NULL"
			}
			return td_with_text(refText)
		}

		row.appendChild(handle_obj_ref.bind(obj)("com:relatedObject"))
		row.appendChild(handle_obj_ref.bind(obj)("com:sourceObject"))

		tblBody.appendChild(row)
	})

	tbl.appendChild(tblBody);
	target_div.appendChild(tbl);
}

function default_drawer(node, target_div) {
	target_div = target_div || div_main
	if (node.getAttributeNames().length > 0)
		draw_table(node, target_div)
}

function draw_table(node, target_div) {
	target_div = target_div || div_main
	var keys = node.getAttributeNames()
	var comment = node.getAttribute("comment")

	if (typeof comment != 'undefined' && comment != null) {
		var index = keys.indexOf("comment")
		keys.splice(index, 1)
	}

	var elements = keys.map(function (k) {
		return node.getAttribute(k)
	})

	// no table to be shown
	if (elements.length == 0) {
		return
	}

	var tbl = document.createElement("table");
	var tblBody = document.createElement("tbody");

	// ------------------ first blue header ------------------
	var header_row = tableRow(keys);
	header_row.setAttribute("class", "blue_bg");
	tblBody.appendChild(header_row)

	tblBody.appendChild(tableRow(elements))

	// put the <tbody> in the <table>
	tbl.appendChild(tblBody);

	target_div.appendChild(tbl);
}

function draw_errors(node, target_div) {
	target_div = target_div || div_main
	// check if errors entry exists, if not, then exit
	if (node.childrenByTag("mal:errors", 0) == null) {
		return
	}

	// assumes only one entry
	var errorsNode = node.childrenByTag("mal:errors", 0)

	// first if entry exists
	if (errorsNode.childrenByTag("mal:errorRef", 0)) {
		var h2 = document.createElement("h2");
		h2.innerHTML = "Errors";
		target_div.appendChild(h2);

		// ------------------ first blue header ------------------
		var tbl = document.createElement("table");
		var tblBody = document.createElement("tbody");

		var header_row = tableRow(ERROR_HEADER);
		header_row.setAttribute("class", "blue_bg");
		tblBody.appendChild(header_row)

		errorsNode.eachTag("mal:errorRef", function (err) {
			// errors
			tblBody.appendChild(tr_errorRef(err))
		})
		// put the <tbody> in the <table>
		tbl.appendChild(tblBody);
		target_div.appendChild(tbl);

	}
}

function draw_documentation(node, target_div) {
	target_div = target_div || div_main

	// Group documentation elements by name, preserving insertion order
	var groups = {}
	var groupOrder = []
	node.eachTag("mal:documentation", function (doc) {
		var name = doc.getAttribute("name")
		if (!groups[name]) {
			groups[name] = []
			groupOrder.push(name)
		}
		groups[name].push(doc.textContent.trim())
	})

	groupOrder.forEach(function (name) {
		var items = groups[name]

		var h2 = document.createElement("h2")
		// Pluralize if multiple items and name doesn't already end in 's'
		h2.innerHTML = (items.length > 1 && name.slice(-1) !== 's') ? name + 's' : name
		target_div.appendChild(h2)

		if (items.length === 1) {
			var p = document.createElement("p")
			p.innerHTML = format_line_breaks(items[0])
			target_div.appendChild(p)
		} else {
			var ol = document.createElement("ol")
			items.forEach(function (text) {
				var li = document.createElement("li")
				li.innerHTML = format_line_breaks(text)
				ol.appendChild(li)
			})
			target_div.appendChild(ol)
		}
	})
}

function tr_errorRef(node, target_div) {
	target_div = target_div || div_main
	var row = document.createElement("tr");

	// ------------- error type
	row.appendChild(td_with_text(str_mal_node_type(node, "")))

	// ------------- comment
	var comment = node.getAttribute("comment")
	if (typeof comment != 'undefined' && comment != null) {

		row.appendChild(td_table_comment(node.getAttribute("comment")))

		// row.appendChild(td_with_text(comment))
	} else {
		row.appendChild(td_with_text(""))
	}

	if (node.childrenByTag("mal:extraInformation", 0)) {
		var extraInfo = node.childrenByTag("mal:extraInformation", 0)
		// ------------- Extra Info Type
		row.appendChild(td_with_text(str_mal_node_type(extraInfo)))

		// ------------- Extra Info Comment

		if (extraInfo.getAttribute("comment").length < TABLE_COMMENT_LENGTH_LIMIT) {
			row.appendChild(td_with_text(extraInfo.getAttribute("comment")))
		} else {
			row.appendChild(td_table_comment(extraInfo.getAttribute("comment")))
		}

	} else {
		row.appendChild(td_with_text("Not used", 2))
	}

	return row
}

function td_table_comment(full_comment, unique_sufix) {
	unique_sufix = unique_sufix || gen_suffix()

	if (full_comment.length < TABLE_COMMENT_LENGTH_LIMIT)
		return td_with_text(full_comment);

	var shortComment = full_comment.split(/\s+/).slice(0, COMMENT_MIN_WORDS).join(" ") + "..."

	var hidden_comment_div = document.createElement("div");
	var shown_comment_a = document.createElement("a");

	var hidden_comment_div_id = "hc_" + unique_sufix
	var shown_comment_a_id = "a_" + unique_sufix

	hidden_comment_div.setAttribute("id", hidden_comment_div_id);
	shown_comment_a.setAttribute("id", shown_comment_a_id);

	hidden_comment_div.setAttribute("class", "comment");
	shown_comment_a.setAttribute("class", "note");

	shown_comment_a.innerHTML = shortComment
	hidden_comment_div.innerHTML = format_line_breaks(full_comment)

	var td = td_with_element(shown_comment_a)
	var td_id = "td_" + unique_sufix
	td.setAttribute("id", td_id);

	shown_comment_a.appendChild(hidden_comment_div)

	post_draw.push(comment_management_function(shown_comment_a_id, hidden_comment_div_id, td_id, 0.15, 1));

	return td
}

function draw_comments(node, target_div) {
	target_div = target_div || div_main
	var comment = node.getAttribute("comment")
	if (typeof comment != 'undefined' && comment != null && comment != "") {
		var h2 = document.createElement("h2");
		h2.innerHTML = "Comment";

		target_div.appendChild(h2);
		target_div.innerHTML += format_line_breaks(comment) + "<br/>";
	}

	var note_counter = 1
	node.eachTag("mal:extraInformation", function (ei) {
		var h3 = document.createElement("h3");
		h3.innerHTML = "Note " + note_counter;

		target_div.appendChild(h3);
		target_div.innerHTML += format_line_breaks(ei.getAttribute("comment")) + "<br/>";
		note_counter++
	})
}

function d_mal_area(node, target_div) {
	target_div = target_div || div_main
	draw_table(node, target_div)

	var comment = node.getAttribute("comment")
	if (comment && comment !== "") {
		var h2 = document.createElement("h2")
		h2.innerHTML = "Overview"
		target_div.appendChild(h2)

		var p = document.createElement("p")
		p.innerHTML = format_line_breaks(comment)
		target_div.appendChild(p)
	}
}

function d_pdf(node, target_div) {
	target_div = target_div || div_main

//	target_div.innerHTML = node.tagName
	var pdframe = document.createElement("iframe");
	pdframe.setAttribute("src",node.pdfInfo.pdfFilePath);
	target_div.appendChild(pdframe);
}

drawers = {}
drawers["default"] = default_drawer

drawers["mal:area"] = d_mal_area
drawers["mal:service"] = d_mal_service

drawers["mal:sendIP"] = d_mal_ip
drawers["mal:submitIP"] = d_mal_ip
drawers["mal:requestIP"] = d_mal_ip
drawers["mal:invokeIP"] = d_mal_ip
drawers["mal:progressIP"] = d_mal_ip
drawers["mal:pubsubIP"] = d_mal_ip

drawers["mal:enumeration"] = d_mal_enum

drawers["mal:fundamental"] = d_mal_fundamental
drawers["mal:attribute"] = d_mal_attribute
drawers["mal:composite"] = d_mal_composite

drawers["com:objects"] = d_com_objects
drawers["com:events"] = d_com_events


drawers["book"] = d_pdf
