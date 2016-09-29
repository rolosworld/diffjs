/*
 Copyright (c) 2016 Rolando González Chévere <rolosworld@gmail.com>
 
 This file is part of diffjs.
 
 diffjs is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License version 3
 as published by the Free Software Foundation.
 
 diffjs is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with diffjs.  If not, see <http://www.gnu.org/licenses/>.
*/

var diffjs = {
    diff: (function() {
        var indexes_map = function(list_A, list_B) {
	    var map = [];

	    for (var i = 0; i < list_B.length; i++) {
	        var found = [];
	        for (var j = 0; j < list_A.length; j++) {
		    if (list_A[j] === list_B[i]) {
		        found.push(j);
		    }
	        }

	        map.push(found);
	    }

	    return map;
        }; // indexes_map

        var has = function(d, v) {
	    for (var i = 0; i < d.length; i++) {
	        if (d[i] == v) {
		    return 1;
	        }
	    }

	    return 0;
        };


        var clean_sequences = function(best, sequences, idxs) {
	    var cleaned = [];
	    for (var i = 0; i < sequences.length; i++) {
	        var s = sequences[i];
	        if (has(idxs, s.idx)) {
		    cleaned.push(s);
		    continue;
	        }

	        if (s.idx == best.idx) {
		    cleaned.push({
		        idx: best.idx,
		        seq: [best.seq]
		    });
	        }
	        else {
		    if (s.idx > best.idx && s.idx < best.idx + best.seq.length) {
		        // Ignore this sequences since they're included in the best sequence
		    }
		    else {
		        var seqs = s.seq;
		        var cseqs = [];

		        // For each sequence, remove the idx's that conflict
		        for (var j = 0; j < seqs.length; j++) {
			    var seq = seqs[j];
			    var new_seq = [];
			    if (s.idx < best.idx) {
			        var max_idx = s.idx + seq.length;
			        var di = max_idx - best.idx;
			        if (di > 0) {
				    seq = seq.slice(0, seq.length - di);
			        }
			    }

			    var valid = 1;
			    for (var k = 0; k < seq.length; k++) {
			        if (s.idx < best.idx) {
				    if (seq[k] >= best.seq[0]) {
				        valid = 0;
				        break;
				    }
			        }
			        else {
				    if (seq[k] <= best.seq[best.seq.length - 1]) {
				        valid = 0;
				        break;
				    }
			        }

			        new_seq.push(seq[k]);
			    }

			    if (new_seq.length) {
			        cseqs.push(new_seq);
			    }
		        }

		        // Store the cleaned sequences
		        s.seq = cseqs;

		        cleaned.push(s);
		    }
	        }
	    }

	    return cleaned;
        }; // clean_sequences

        // Return the best sequence, ignore the given idx list
        var best_sequence = function(sequences, idxs) {
	    var best = {idx:0, seq: []};
	    for (var i = 0; i < sequences.length; i++) {

	        if (has(idxs, sequences[i].idx)) {
		    continue;
	        }

	        var seqs = sequences[i].seq;
	        for (var j = 0; j < seqs.length; j++) {
		    var seq = seqs[j];

		    // Store the best overall sequence
		    if (best.seq.length < seq.length) {
		        best.idx = sequences[i].idx;
		        best.seq = seq;
		    }
	        }
	    }

	    return best;
        }; // best_sequence

        var calculate_sequences = function(data) {
	    var sequences = [];

	    // For each line, get the list of possible sequences
	    for (var i = 0; i < data.length; i++) {
	        var line = data[i];

	        // Start a new sequence
	        var sequence = {idx: i, seq: []};
	        for (var j = 0; j < line.length; j++) {
		    var cur = line[j];
		    var seq = [cur];

		    for (var k = i + 1; k < data.length; k++) {
		        cur++;

		        // Add a new sequence value if found
		        if (has(data[k], cur)) {
			    seq.push(cur);
		        }
		        else {
			    // Break the sequence value search
			    break;
		        }
		    }

		    // Store the sequence values found
		    sequence.seq.push(seq);
	        }

	        // Store the sequence
	        sequences.push(sequence);
	    }

	    var overall_best = [];
	    for (var best = best_sequence(sequences, overall_best); best.seq.length; best = best_sequence(sequences, overall_best)) {
	        sequences = clean_sequences(best, sequences, overall_best);
	        overall_best.push(best.idx);
	    }

	    return sequences;
        };

        var prepare_report = function(sequences, original, changed) {
	    var report = [];
	    var count = 0;
	    for (var i = 0; i < sequences.length; i++) {
	        var line = sequences[i];
	        if (line.seq.length) {
		    var seq = line.seq[0];
		    for (var j = 0; j < seq.length; j++) {
		        var id = seq[j];

		        if (id !== count) {
			    for (var k = count; k < id; k++) {
			        report.push({
				    status: '-',
				    str: original[k]
			        });
			    }
		        }

		        count = id + 1;
		        report.push({
			    status: ' ',
			    str: original[id]
		        });
		    }
	        }
	        else {
		    report.push({
		        status: '+',
		        str: changed[line.idx]
		    });
	        }
	    }

	    if (count < original.length) {
	        for (var i = count; i < original.length; i++) {
		    report.push({
		        status: '-',
		        str: original[i]
		    });
	        }
	    }

	    return report;
        }; // prepare_report

        return function(original, changed, context_margin) {
	    original = original.split("\n");
	    changed = changed.split("\n");

	    var changed_to_original_map = indexes_map(original, changed);
	    var sequences = calculate_sequences(changed_to_original_map);
	    var report = prepare_report(sequences, original, changed);

	    // Prepare human redeable output similar to "diff -u"
	    var out = [
	        "--- a",
	        "+++ b"
	    ];

	    // Get the relevant sections
	    var sections = [];
	    var section = [];

	    var ctx_margin = context_margin === undefined ? 2 : context_margin;
	    var ctx = [];
	    var need_tail = 0;
	    var oline = 0, cline = 0, ncount = 0, pcount = 0;
	    for (var i = 0; i < report.length; i++) {
	        var line = report[i];

	        // Close the section if we will process a non changed line and we reached the end context limit
	        if (line.status == ' ' && need_tail && ctx.length > ctx_margin) {
		    section = section.concat(ctx);
		    ctx = [];
		    need_tail = 0;

		    // Last section item is the line numbers
		    section.push({
		        oline: oline,
		        ncount: ncount,
		        cline: cline,
		        pcount: pcount
		    });
		    sections.push(section);

		    section = [];
		    ncount = 0;
		    pcount = 0;
	        }

	        if (line.status == '-') {
		    oline++;
		    ncount++;
		    section = section.concat(ctx);
		    ctx = [];
		    need_tail = 1;
		    section.push(line);
	        }
	        else if (line.status == '+') {
		    cline++;
		    pcount++;
		    section = section.concat(ctx);
		    ctx = [];
		    need_tail = 1;
		    section.push(line);
	        }
	        else if (line.status == ' ') {
		    oline++;
		    cline++;
		    if (ctx.length > ctx_margin) {
		        ctx.shift();
		    }
		    ctx.push(line);
	        }
	    };

	    // Close non empty sections
	    if (section.length) {
	        section = section.concat(ctx);
	        section.push({
		    oline: oline,
		    ncount: ncount,
		    cline: cline,
		    pcount: pcount
	        });
	        sections.push(section);
	    }

	    //
	    for (var i = 0; i < sections.length; i++) {
	        section = sections[i];
	        var stats = section.pop();
	        var otot = section.length - stats.pcount;
	        var ctot = section.length - stats.ncount;
	        out.push('@@ -'+(stats.oline - otot + 1)+','+otot+' +'+(stats.cline - ctot + 1)+','+ctot+' @@');
	        for (var j = 0; j < section.length; j++) {
		    var line = section[j];
		    out.push(line.status + line.str);
	        }
	    }

	    if (out.length == 2) {
	        return '';
	    }

	    return out.join("\n");
        };
    })(), // diff

    /********************/

    patch: function(text, diff) {
        text = text.split("\n");
        diff = diff.split("\n");

        var ntext = [];
        var new_pos = 0;
        for (var i = 0; i < diff.length; i++) {
	    if (diff[i].charAt(0) == '@') {
	        var parts = diff[i].split(' ');
	        var oparts = parts[1].split(',');
	        var cparts = parts[2].split(',');
	        var lnum = oparts[0] * -1 - 1;
	        ntext = ntext.concat(text.slice(new_pos, lnum));
	        new_pos = lnum;
	        oparts = parseInt(oparts[1]);
	        cparts = parseInt(cparts[1]);
	        var max = oparts > cparts ? oparts : cparts;
	        for (var j = 0; j < max; j++, new_pos++) {
		    var line = diff[j+i+1];
		    var mode = line.charAt(0);
		    var str = line.substr(1);
		    if ( mode == ' ' ) {
		        ntext.push(str);
		    }
		    else if ( mode == '-' ) {
		    }
		    else {
		        ntext.push(str);
		        new_pos--;
		    }
	        }
	    }
        }

        ntext = ntext.concat(text.slice(new_pos, text.length - 1));

        return ntext.join("\n");
    } // patch
};
