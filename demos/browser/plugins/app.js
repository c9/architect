define(function () {

    appPlugin.consumes = ["math"];
    return appPlugin;

    function appPlugin(options, imports, register) {
        console.log("math", imports.math);
        var p = document.createElement("p");
        p.textContent = "1 + 4 = " + imports.math.add(1, 4);
        document.body.appendChild(p);
        register();
    }

});