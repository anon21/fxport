
var fxport = function() {
	// JSM読み込み
	Components.utils.import("resource://gre/modules/PlacesUtils.jsm");
	
	// お約束の短縮
	const Cc = Components.classes;
	const Ci = Components.interfaces;
	
	// 時間定数
	const PR_USEC_PER_MSEC = 1000;
	
	// ファイルオープン定数
	const PR_RDONLY = 0x01;
	const PR_WRONLY = 0x02;
	const PR_RDWR = 0x04;
	const PR_CREATE_FILE = 0x08;
	const PR_APPEND = 0x10;
	const PR_TRUNCATE = 0x20;
	const PR_SYNC = 0x40;
	const PR_EXCL = 0x80;
	
	// XPCOMサービス
	var dirServ = Cc["@mozilla.org/file/directory_service;1"]
		.getService(Ci.nsIProperties);
	var loginMgr = Cc["@mozilla.org/login-manager;1"]
		.getService(Ci.nsILoginManager);
	var permMgr = Cc["@mozilla.org/permissionmanager;1"]
		.getService(Ci.nsIPermissionManager);
	
	// デバッグログ表示用
	var Application = Components.classes["@mozilla.org/fuel/application;1"]
		.getService(Components.interfaces.fuelIApplication);
	
	// ローカライズ文字列
	var strBundle = Cc["@mozilla.org/intl/stringbundle;1"]
		.getService(Ci.nsIStringBundleService)
		.createBundle("chrome://fxport/locale/fxport.properties");
	
	/**
	 * 現在のプロファイル名を取得する
	 * 参考：http://d.hatena.ne.jp/nokturnalmortum/20081105
	 */
	function getCurrentProfileName() {
		var dirName = dirServ.get("ProfD", Ci.nsIFile).path;
		
		return dirName.replace(/.*[\\\/]/, "").replace(/.+?\./, "");
	}
	
	/**
	 * 現在の日付と時刻を文字列で取得する
	 * e.g. 2010-9-30_07-00
	 */
	function getDateString() {
		var date = new Date();
		
		return date.getFullYear() +
			"-" + (date.getMonth() + 1) +
			"-" + date.getDate() +
			"_" + ("0" + date.getHours()).substr(-2) +
			"-" + ("0" + date.getMinutes()).substr(-2);
	}
	
	/**
	 * ブックマークをエクスポートする
	 * PlacesUtils.jsmのPlacesUtils.backupBookmarksToFile()を参考
	 * 実際にバックアップをファイルに書き出す部分はbackups._writeBackupFile()
	 * この部分をファイルに書き込まず，ストリームのままZIPWriterで書き出す
	 */
	function exportBookmarks(wr, rep) {
		// 一時ファイルを作成して，ブックマークをJSON形式で書き込む
		var file = dirServ.get("TmpD", Ci.nsIFile);
		file.append("fxport-bookmarks.tmp");
		file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0664);
		
		PlacesUtils.backupBookmarksToFile(file);
		
		// 一時ファイルをZIPに書き込む
		wr.addEntryFile("bookmarks.json",
			Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
		
		// 一時ファイルを削除
		file.remove(false);
	}
	
	/**
	 * パスワードをエクスポートする
	 */
	function exportPasswords(wr, rep) {
		// ログイン情報をJSON文字列に変換
		var loginInfos = loginMgr.getAllLogins({});
		var str = JSON.stringify(loginInfos);
		
		// UTF-8文字列を入力するストリームを用意して，JSON文字列を書き込む
		var uconv = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Ci.nsIScriptableUnicodeConverter);
		uconv.charset = "UTF-8";
		
		var strStream = uconv.convertToInputStream(str);
		
		// ZIPファイルへ書き込み
		wr.addEntryStream("passwords.json", Date.now() * PR_USEC_PER_MSEC,
			Ci.nsIZipWriter.COMPRESSION_DEFAULT, strStream, false);
	}
	
	/**
	 * サイト設定をエクスポートする
	 */
	function exportPerms(wr, opt, rep) {
		// サイト設定の情報を配列に保存し，JSON文字列に変換
		var permsEnum = permMgr.enumerator;
		var perms = [];
		const typeMap = {
			install: "installPerms",
			popup: "popupPerms",
			cookie: "cookiePerm",
			image: "imagePerms",
		};
		
		while( permsEnum.hasMoreElements() ) {
			var perm = permsEnum.getNext().QueryInterface(Ci.nsIPermission);
			
			if( typeMap[perm.type] && opt[typeMap[perm.type]] ) {
				perms.push({
					host: perm.host,
					type: perm.type,
					capability: perm.capability,
				});
			}
		}
		
		var str = JSON.stringify(perms);
		
		// UTF-8文字列を書き込むストリームを用意して，JSON文字列を書き込む
		var uconv = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Ci.nsIScriptableUnicodeConverter);
		uconv.charset = "UTF-8";
		
		var strStream = uconv.convertToInputStream(str);
		
		// ZIPファイルへ書き込み
		wr.addEntryStream("perms.json", Date.now() * PR_USEC_PER_MSEC,
			Ci.nsIZipWriter.COMPRESSION_DEFAULT, strStream, false);
	}
	
	/**
	 * 検索プラグインをエクスポートする
	 */
	function exportSearchPlugins(wr, rep) {
		var dir = dirServ.get("ProfD", Ci.nsIFile);
		dir.append("searchplugins");
		
		if( dir.exists() && dir.isDirectory() ) {
			wr.addEntryDirectory("searchplugins", Date.now() * PR_USEC_PER_MSEC, false);
			
			var entries = dir.directoryEntries;
			
			while( entries.hasMoreElements() ) {
				var file = entries.getNext().QueryInterface(Ci.nsIFile);
				
				wr.addEntryFile(file.leafName,
					Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
			}
		} else {
			
		}
	}
	
	/**
	 * user.jsをエクスポートする
	 */
	function exportUserJs(wr, rep) {
		var file = dirServ.get("ProfD", Ci.nsIFile);
		file.append("user.js");
		
		if( file.exists() && file.isFile() ) {
			wr.addEntryFile("user.js",
				Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
		} else {
			rep.push("no entry userjs");
		}
	}
	
	/**
	 * prefs.jsをエクスポートする
	 */
	function exportPrefsJs(wr, rep) {
		var file = dirServ.get("ProfD", Ci.nsIFile);
		file.append("prefs.js");
		
		if( file.exists() && file.isFile() ) {
			wr.addEntryFile("prefs.js",
				Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
		} else {
			rep.push("no entry prefsjs");
		}
	}
	
	/**
	 * userChrome.cssをエクスポートする
	 */
	function exportUserChromeCss(wr, rep) {
		var file = dirServ.get("UChrm", Ci.nsIFile);
		file.append("userChrome.css");
		
		if( file.exists() && file.isFile() ) {
			wr.addEntryFile("userChrome.css",
				Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
		} else {
			rep.push("no entry chrome");
		}
	}
	
	/**
	 * userContent.cssをエクスポートする
	 */
	function exportUserContentCss(wr, rep) {
		var file = dirServ.get("UChrm", Ci.nsIFile);
		file.append("userContent.css");
		
		if( file.exists() && file.isFile() ) {
			wr.addEntryFile("userContent.css",
				Ci.nsIZipWriter.COMPRESSION_DEFAULT, file, false);
		} else {
			rep.push("no entry content");
		}
	}
	
	return {
		/**
		 * プロファイルをエクスポートする
		 */
		exportProfile: function() {
			// どの項目をエクスポートするかダイアログで選択
			var opt = {};
			var rv = {};
			
			window.openDialog("chrome://fxport/content/export-dialog.xul", null,
				"dialog,modal,toolbar", opt, rv);
			
			if( !rv.value )
				return;
			
			// 選択された項目が一つもなければ，そこで終了
			var cont = false;
			
			for(var b in opt) {
				cont = cont || b;
			}
			
			if( !cont )
				return;
			
			// 保存ファイル名の指定
			var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
			fp.init(window, strBundle.GetStringFromName("exportProfile"), fp.modeSave);
			fp.appendFilter(strBundle.GetStringFromName("filterNameFxport"), "*.fxport");
			fp.defaultString = getCurrentProfileName() + "_" + getDateString() + ".fxport";
			
			rv = fp.show();
			if( rv != fp.returnOK && rv != fp.returnReplace )
				return;
			
			// エクスポート
			var wr = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
			var rep = [];
			
			wr.open(fp.file, PR_WRONLY | PR_CREATE_FILE);
			
			if( opt.bookmarks )
				exportBookmarks(wr, rep);
			
			if( opt.passwords )
				exportPasswords(wr, rep);
			
			if( opt.installPerms || opt.popupPerms || opt.cookiePerms || opt.imagePerms )
				exportPerms(wr, opt, rep);
			
			if( opt.searchPlugins )
				exportSearchPlugins(wr, rep);
			
			if( opt.userJs )
				exportUserJs(wr, rep);
			
			if( opt.prefsJs )
				exportPrefsJs(wr, rep);
			
			if( opt.userChromeCss )
				exportUserChromeCss(wr, rep);
			
			if( opt.userContentCss )
				exportUserContentCss(wr, rep);
			
			wr.close();
			
			// 結果を報告
			var nb = gBrowser.getNotificationBox();
			nb.appendNotification(JSON.stringify(rep), "fxport", null, nb.PRIORITY_INFO_MEDIUM, []);
		},
		
		/**
		 * プロファイルをインポートする
		 */
		importProfile: function() {
			
		},
		
		/**
		 * プロファイルをマージする
		 */
		mergeProfile: function() {
			
		},
		
		/**
		 * プロファイルの最適化を行う
		 */
		optimizeProfile: function() {
			
		},
	};
}();
