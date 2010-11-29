
var fxportExportDialog = function() {
	
	return {
		/**
		 * 選択された項目を取得する
		 */
		onAccept: function() {
			var opt = window.arguments[0];
			
			opt.bookmarks = document.getElementById("export-bookmarks-chkbox").checked;
			opt.passwords = document.getElementById("export-passwords-chkbox").checked;
			opt.installPerms = document.getElementById("export-install-perms-chkbox").checked;
			opt.popupPerms = document.getElementById("export-popup-perms-chkbox").checked;
			opt.cookiePerms = document.getElementById("export-cookie-perms-chkbox").checked;
			opt.imagePerms = document.getElementById("export-image-perms-chkbox").checked;
			opt.searchPlugins = document.getElementById("export-search-plugins-chkbox").checked;
			opt.prefsJs = document.getElementById("export-prefs-js-chkbox").checked;
			opt.userJs = document.getElementById("export-bookmarks-chkbox").checked;
			opt.userChromeCss = document.getElementById("export-user-chrome-css-chkbox").checked;
			opt.userContentCss = document.getElementById("export-user-content-css-chkbox").checked;
			
			// OKボタンが押されたことを保存しておく
			window.arguments[1].value = true;
		},
		
		/**
		 * エクスポートをキャンセルする
		 */
		onCancel: function() {
			// キャンセルボタンが押されたことを保存しておく
			window.arguments[1].value = false;
		},
	};
}();
