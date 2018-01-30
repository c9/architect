const architect = require("./architect");
const test = require("tape");
const fs = require("fs");
const promisify = require("util").promisify;
const path = require("path");

const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);
const mkdirp = promisify(require("mkdirp"));

test("resolve config resolved", assert => {
    const config = [{
        setup: function() {
            // noop
        },
        provides: ["foo"],
        consumes: ["foo"]
    }];

    architect.resolveConfig(config, "", (err, resolvedConfig) => {
        assert.ok(!err, "no error");
        assert.deepEqual(resolvedConfig, config);
        assert.end();
    });
});

test("resolve config from basepath + node_modules", async(assert) => {
    const fakePlugin = `
        module.exports = {
            setup: function(){
                // noop
            },
            provides: ["foo"],
            consumes: ["foo"]
        }
    `;

    let packagePath = "_fake/plugin_" + Date.now();
    let packageDir = "/tmp/_architect_test_fixtures/node_modules";
    let fullPath = packageDir + "/" + packagePath + ".js";

    let config = [
        packagePath,
    ];

    await mkdirp(path.dirname(fullPath));
    await writeFile(fullPath, fakePlugin.toString());

    architect.resolveConfig(config, path.dirname(packageDir), async(err, resolvedConfig) => {
        assert.ok(!err);

        assert.equal(resolvedConfig[0].packagePath, fullPath);
        assert.deepEqual(resolvedConfig[0].consumes, ["foo"]);
        assert.deepEqual(resolvedConfig[0].provides, ["foo"]);

        await unlink(fullPath);
        assert.end();
    });
});

test("resolve config from basepath + node_modules, async", async(assert) => {
    const fakePlugin = `
        module.exports = {
            setup: function(){
                // noop
            },
            provides: ["foo"],
            consumes: ["foo"]
        }
    `;

    let packagePath = "_fake/plugin_" + Date.now();
    let packageDir = "/tmp/_architect_test_fixtures/node_modules";
    let fullPath = packageDir + "/" + packagePath + ".js";

    let config = [
        packagePath,
    ];

    await mkdirp(path.dirname(fullPath));
    await writeFile(fullPath, fakePlugin.toString());

    let resolvedConfig = await architect.resolveConfig(config, path.dirname(packageDir));

    assert.equal(resolvedConfig[0].packagePath, fullPath);
    assert.deepEqual(resolvedConfig[0].consumes, ["foo"]);
    assert.deepEqual(resolvedConfig[0].provides, ["foo"]);

    await unlink(fullPath);
    assert.end();
});

test("it should start an architect app (classic)", async(assert) => {
    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {
                register(null);
            },
            provides: [],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {
                register(null, {
                    "bar.plugin": {
                        iamBar: true
                    }
                });
            },
            provides: ["bar.plugin"],
            consumes: []
        }
    ];

    architect.createApp(fakeConfig, (err) => {
        assert.ok(!err, "no err");
        assert.end();
    });
});

test("it should provide imports", async(assert) => {
    let iamBar = false;

    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {
                assert.ok(imports["bar.plugin"].iamBar);
                iamBar = true;
                register();
            },
            provides: [],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {
                register(null, {
                    "bar.plugin": {
                        iamBar: true
                    }
                });
            },
            provides: ["bar.plugin"],
            consumes: []
        }
    ];

    architect.createApp(fakeConfig, (err) => {
        assert.ok(!err, "no err");
        assert.ok(iamBar, "iamBar was imported");
        assert.end();
    });
});

test("it should provide imports", async(assert) => {
    let barDestroyed = false;

    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {
                assert.ok(imports["bar.plugin"].iamBar);
                register();
            },
            provides: [],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {
                register(null, {
                    onDestroy: function() {
                        barDestroyed = true;
                    },
                    "bar.plugin": {
                        iamBar: true
                    }
                });
            },
            provides: ["bar.plugin"],
            consumes: []
        }
    ];

    architect.createApp(fakeConfig, (err, app) => {
        assert.ok(!err, "no err");

        app.destroy();

        assert.ok(barDestroyed, "barDestroyed");

        assert.end();
    });
});


test("it allow loading additionalPlugins", async(assert) => {
    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {
                assert.ok(imports["bar.plugin"].iamBar);
                register();
            },
            provides: [],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {
                register(null, {
                    "bar.plugin": {
                        iamBar: true
                    }
                });
            },
            provides: ["bar.plugin"],
            consumes: []
        }
    ];

    let app = architect.createApp(fakeConfig, (err) => {
        assert.ok(!err, "no err");
    });

    app.on("ready", () => {
        let loadedBar = false;

        const fakeAdditional = [
            {
                packagePath: "biz/plugin",
                setup: function(config, imports, register) {
                    assert.ok(imports["bar.plugin"].iamBar);
                    loadedBar = true;
                    register();
                },
                provides: [],
                consumes: ["bar.plugin"]
            }
        ];

        app.loadAdditionalPlugins(fakeAdditional, (err) => {
            assert.ok(!err, "no err");
            assert.ok(loadedBar, "loadedBar");
            assert.end();
        });
    });
});

test("it detects cyclic dependencies (classic)", async(assert) => {
    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {},
            provides: ["foo.plugin"],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {},
            provides: ["bar.plugin"],
            consumes: ["foo.plugin"]
        }
    ];

    architect.createApp(fakeConfig, (err) => {
        let expect = "Could not resolve dependencies\nConfig contains cyclic dependencies";
        assert.equal(err.message, expect);
        assert.end();
    });
});

test("it checks the provides", async(assert) => {
    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {
                register(null);
            },
            provides: [],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {
                register(null, {});
            },
            provides: ["bar.plugin"],
            consumes: []
        }
    ];

    architect.createApp(fakeConfig, (err) => {
        assert.ok(/Plugin failed to provide bar.plugin service/.test(err.message));
        assert.end();
    });
});

test("it checks all dependencies", async(assert) => {
    const fakeConfig = [{
            packagePath: "foo/plugin",
            setup: function(config, imports, register) {},
            provides: ["foo.plugin"],
            consumes: ["bar.plugin"]
        },
        {
            packagePath: "bar/plugin",
            setup: function(config, imports, register) {},
            provides: [],
            consumes: []
        }
    ];

    architect.createApp(fakeConfig, (err) => {
        let expect = "Could not resolve dependencies\nMissing services: bar.plugin";
        assert.equal(err.message, expect);
        assert.end();
    });
});

test("it validates config (consumes must be present)", async(assert) => {
    const fakeConfig = [{
        packagePath: "foo/plugin",
        setup: function(config, imports, register) {},
        provides: [],
    }];

    architect.createApp(fakeConfig, (err) => {
        assert.ok(/Plugin is missing the consumes array/.test(err.message));
        assert.end();
    });

});

test("it validates config (provides must be present)", async(assert) => {
    const fakeConfig = [{
        packagePath: "foo/plugin",
        setup: function(config, imports, register) {},
    }];

    architect.createApp(fakeConfig, (err) => {
        assert.ok(/Plugin is missing the provides array/.test(err.message));
        assert.end();
    });

});

test("it validates config (setup must be present)", async(assert) => {
    const fakeConfig = [{
        packagePath: "foo/plugin",
    }];

    architect.createApp(fakeConfig, (err) => {
        assert.ok(/Plugin is missing the setup function/.test(err.message));
        assert.end();
    });
});

