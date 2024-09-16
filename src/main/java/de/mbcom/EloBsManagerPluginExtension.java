package de.mbcom;

import java.util.List;

/**
 * Extension class for the ELO BS Manager Plugin.
 * This class holds the configuration properties for the plugin.
 */
public class EloBsManagerPluginExtension {
    private List<String> bsUrls;

    /**
     * Gets the list of Business Solution URLs.
     *
     * @return a list of URLs pointing to the Business Solutions to be downloaded and installed
     */
    public List<String> getBsUrls() {
        return bsUrls;
    }

    /**
     * Sets the list of Business Solution URLs.
     *
     * @param bsUrls a list of URLs pointing to the Business Solutions to be downloaded and installed
     */
    public void setBsUrls(List<String> bsUrls) {
        this.bsUrls = bsUrls;
    }
}