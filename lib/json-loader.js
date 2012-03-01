if (!require.extensions[".json"]) {
    require.extensions[".json"] = function(request, path) {
        return JSON.parse(require("fs").readFileSync(path));
    };
}
