
var Sync = $({});
jQuery.extend(Sync, {
    init: function Sync_init() {
        Model.initialize().next(Sync.sync);
    },
    _syncing: false,
    sync: function Sync_sync() {
        if (Sync._syncing) return;
        Sync._syncing = true;
        var url = UserManager.user.dataURL + '?_now=' + (new Date).getTime();
        var timestamp;
        console.log(222);
        M('Bookmark').findFirst({order: 'date desc'}).next(function(b) {
            console.log(b);
            if (b) url += '&' + b.get('date');
        }).next($K($.get(url))).next(Sync.dataSync).error(Sync.errorback);
    },
    errorback: function(e) {
        p('Sync Error: ', e);
        Sync._syncing = false;
        Sync.trigger('fail');
    },
    dataSync: function Sync_dataSync(res) {
        Sync.trigger('progress', {value: 0});
        var Bookmark = M('Bookmark');

        var text = res;
        if (!text.length) {
            Sync.trigger('complete');
            return;
        }

        var items = Config.get("sync.oneTimeItmes") || 200;
        var waitTime = Config.get("sync.syncWait") || 1000;

        var commentRe = new RegExp('\\s+$','');
        var tmp = Sync.createDataStructure(text);
        var bookmarks = tmp[0];
        var infos = tmp[1];
        delete tmp;
        p(sprintf('start: %d data', infos.length));
        var now = Date.now();
        p('start');
        var len = infos.length;
        Bookmark.transaction(function() {
            for (var i = len - 1;  i >= 0; i--) {
                var bi = i * 3;
                var timestamp = infos[i].split("\t", 2)[1];
                var title = bookmarks[bi];
                var comment = bookmarks[bi+1];
                var url = bookmarks[bi+2];
                var b = new Bookmark;
                b.title = title;
                b.comment = comment.replace(commentRe, '');
                b.url = url;
                b.date = parseInt(timestamp);
                if (url) {
                    try {
                        b.save().error(function() {
                            console.error('error: ' + [url, title, comment, timestamp].toString());
                        });
                    } catch(e) {
                    }
                } else {
                }
                if (i && (i % items == 0)) {
                    console.log('' + i + title);
                }
                /*
                if (i && (i % items == 0)) {
                    Sync.dispatch('progress', { value: (len-i)/len*100|0 });
                    Sync.db.commitTransaction();
                    if (i % (items * 10) == 0) {
                        // 大量に件数があるときに、しょっちゅう BookmarksUpdated を発行すると重くなるため
                        $(document).trigger("BookmarksUpdated");
                    }
                    // async.wait(waitTime);
                    Sync.db.beginTransaction();
                    p('wait: ' + (Date.now() - now));
                }
                */
            }
        }).next(function () {
            Sync.trigger('complete');
            $(document).trigger('BookmarksUpdated');

            p('complete:', infos.length);
            p('time: ' + (Date.now() - now));
            Bookmark.count().next(function(r) { p('count:' + r) });
        M('Bookmark').findFirst({order: 'date desc'}).next(function(b) {
            console.log(b.date);
            });
        }).error(Sync.errorback);
    },
    createDataStructure: function Sync_createDataStructure (text) {
        var infos = text.split("\n");
        var bookmarks = infos.splice(0, infos.length * 3/4);
        return [bookmarks, infos];
    },
});

Sync.bind('complete', function() {
    Sync._syncing = false;
});

UserManager.bind('UserChange', function() {
    p('get change');
    if (UserManager.user) Sync.init();
});
