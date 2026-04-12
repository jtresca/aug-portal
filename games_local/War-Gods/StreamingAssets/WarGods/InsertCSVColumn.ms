// Quick hack of a MiniScript program to insert the "Blocked" column 
// into the Attacks.csv files, with appropriate default values.

import "stringUtil"

// Function similar to string.split, except that when it runs into a quotation
// mark, it continues until it finds the closing quote, ignoring any delimiters
// in between.  Currently, delimiter must be a single character.
string.splitQuoted = function(delimiter=" ", maxCount=-1, stripQuotes=true)
	result = []
	curToken = []
	inQuote = false
	for i in self.indexes
		c = self[i]
		if c == """" then
			inQuote = not inQuote
			if not stripQuotes then curToken.push c
		else if c == delimiter and not inQuote then
			result.push curToken.join("")
			curToken = []			
		else
			curToken.push c
		end if
	end for
	if curToken then result.push curToken.join("")
	return result
end function

// Function similar to list.join, except that if any of the elements contains
// the delimiter, then that element is surrounded in quotation marks.
list.joinQuoted = function(delimiter=" ")
	temp = []
	for item in self
		item = str(item)
		if item.indexOf(delimiter) != null then item = """" + item + """"
		temp.push item
	end for
	return temp.join(delimiter)
end function

test = function(s)
	ss = s.splitQuoted(",")
	print ss
	s2 = ss.joinQuoted(",")
	print s2
end function

process = function(path)
	lines = file.readLines(path)
	if lines == null then
		print "Unable to read: " + path
		return
	end if
	for i in lines.indexes
		fields = lines[i].splitQuoted(",")
		if fields.len < 5 then continue
		if fields[5] == "Blocked" then
			print "Already updated: " + path
			return
		end if
		dflags = fields[3]
		if dflags == "Defender Flags" then
			newVal = "Blocked"
		else if dflags.contains("!BLOCKING") or not dflags.contains("BLOCKING") then
			newVal = ""
		else
			newVal = "X"
		end if
		fields.insert 5, newVal
		lines[i] = fields.joinQuoted(",")
		//print lines[i]
	end for
	file.writeLines path, lines
	print "Updated: " + path
end function

//test "0,,2,,,5"
//test "0,""one,uno,ichi"",2,""three,san"""

process "DummyFemale/Attacks.csv"
process "DummyMale/Attacks.csv"
