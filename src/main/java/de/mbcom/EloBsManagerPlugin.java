package de.mbcom;

import com.elo.solutions.scripts.ScriptName;
import com.elo.solutions.scripts.runner.ScriptRuntime;
import com.elo.solutions.scripts.modules.ScriptModuleFactory;
import com.elo.solutions.scripts.runner.ScriptWorker;
import com.elo.solutions.scripts.ScriptArguments;
import com.elo.solutions.scripts.BaseConfig;
import org.apache.commons.io.FileUtils;
import org.gradle.api.Plugin;
import org.gradle.api.Project;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.util.logging.Logger;

/**
 * Gradle plugin to manage ELO Business Solutions.
 */
public class EloBsManagerPlugin implements Plugin<Project> {
    private static final Logger LOGGER = Logger.getLogger(EloBsManagerPlugin.class.getName());

    /**
     * Applies the plugin to the given project.
     *
     * @param project the Gradle project
     */
    @Override
    public void apply(Project project) {
        project.getExtensions().create("elobsmanager", EloBsManagerPluginExtension.class);

        project.task("setupBusinessSolutions").doLast(task -> {
            EloBsManagerPluginExtension extension = project.getExtensions().getByType(EloBsManagerPluginExtension.class);
            setupBusinessSolutions(extension, project);
        }).setGroup("elo");
    }

    /**
     * Sets up the business solutions by downloading and installing them.
     *
     * @param extension the plugin extension containing configuration
     * @param project   the Gradle project
     */
    private void setupBusinessSolutions(EloBsManagerPluginExtension extension, Project project) {
        LOGGER.info("validate properties");
        validateProperties(project);
        LOGGER.info("setup business solutions");
        for (String bsUrl : extension.getBsUrls()) {
            try {
                LOGGER.info("download BS from " + bsUrl);
                URL url = new URL(bsUrl);
                File destination = new File(project.getLayout().getBuildDirectory().get().getAsFile(), "downloads/" + new File(url.getPath()).getName());
                FileUtils.copyURLToFile(url, destination);
                LOGGER.info("install BS from " + destination.getAbsolutePath());
                install(project, destination);
            } catch (IOException e) {
                LOGGER.severe("Failed to install BS: " + e.getMessage());
            }
        }
    }

    /**
     * Installs the business solution package.
     *
     * @param project the Gradle project
     * @param eloinst the file to be installed
     */
    private void install(Project project, File eloinst) {
        LOGGER.info("install package " + eloinst.getName());

        ScriptWorker scriptWorker = provideInstaller();
        BaseConfig config = BaseConfig.builder()
                .ixUrl(project.findProperty("elo.server.ixUrl").toString())
                .username(project.findProperty("elo.server.username").toString())
                .password(project.findProperty("elo.server.password").toString())
                .build();
        scriptWorker.setBaseConfig(config);

        ScriptName entrypoint = ScriptName.of("sol.dev.sh.InstallPackages.js");
        ScriptArguments arguments = ScriptArguments.of(
                "deploy",
                eloinst.getAbsolutePath(),
                project.getLayout().getBuildDirectory().dir("_work").get().toString()
        );
        ScriptRuntime scriptRuntime = scriptWorker.provideScriptRuntime(entrypoint, arguments);

        scriptRuntime.run();
    }

    /**
     * Provides a new instance of ScriptWorker configured for installation.
     *
     * @return a configured ScriptWorker instance
     */
    private static ScriptWorker provideInstaller() {
        ScriptWorker scriptWorker = ScriptWorker.newInstance();
        scriptWorker.registerModule(ScriptModuleFactory.provideClasspathScriptModule()); // root
        scriptWorker.registerModule(ScriptModuleFactory.provideClasspathScriptModule("installer")); // installer folder
        return scriptWorker;
    }

    /**
     * Validates that the required properties are set in the project.
     *
     * @param project the Gradle project
     * @throws IllegalArgumentException if any required property is not set
     */
    private void validateProperties(Project project) {
        if (project.findProperty("elo.server.ixUrl") == null) {
            throw new IllegalArgumentException("elo.server.ixUrl is not set");
        }
        if (project.findProperty("elo.server.username") == null) {
            throw new IllegalArgumentException("elo.server.username is not set");
        }
        if (project.findProperty("elo.server.password") == null) {
            throw new IllegalArgumentException("elo.server.password is not set");
        }
    }
}