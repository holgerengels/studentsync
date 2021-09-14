package studentsync.base;

import com.google.gson.*;
import com.google.gson.stream.JsonReader;

import java.io.*;
import java.util.*;

/**
 * Created by holger on 22.10.16.
 */
public class Configuration {
    private static Configuration INSTANCE = null;

    private JsonObject config;
    private JsonObject settings;
    private String configPath;
    private String settingsPath;

    public Configuration() {
    }

    public synchronized static Configuration getInstance() {
        if (INSTANCE == null)
            INSTANCE = new Configuration();

        return INSTANCE;
    }

    public void setConfigPath(String configPath) {
        this.configPath = configPath;
    }

    public void invalidate() {
        config = null;
    }

    public List<Pair> readPairs() {
        ensureConfig();
        JsonArray array = config.getAsJsonArray("classMapping");
        List<Pair> pairs = new ArrayList<Pair>();
        for (JsonElement element : array) {
            JsonObject object = (JsonObject) element;
            Map.Entry<String, JsonElement> line = object.entrySet().iterator().next();
            Pair pair = new Pair(line.getKey(), line.getValue().getAsString());
            if (!pair.identical()) {
                pairs.add(pair);
                //pairs.add(pair.inverse());
            }
        }
        return pairs;
    }

    public String getString(String domain, String key) {
        ensureConfig();
        JsonElement jsonElement = config.getAsJsonObject(domain).get(key);
        if (jsonElement == null || jsonElement.isJsonNull()) {
            System.err.println("WARNING: Property " + key + " is not configured");
            return null;
        }
        else
            return jsonElement.getAsString();
    }

    public Integer getInteger(String domain, String key) {
        ensureConfig();
        JsonElement jsonElement = config.getAsJsonObject(domain).get(key);
        if (jsonElement == null || jsonElement.isJsonNull()) {
            System.err.println("WARNING: Property " + key + " is not configured");
            return null;
        }
        else
            return jsonElement.getAsInt();
    }

    public JsonObject getConfig() {
        ensureConfig();
        return config;
    }

    private void ensureConfig() {
        if (config == null) {
            FileReader reader = null;
            try {
                reader = new FileReader(configPath);
                config = new Gson().fromJson(new JsonReader(reader), JsonObject.class);
                applySettings();
            }
            catch (FileNotFoundException e) {
                e.printStackTrace();
            }
        }
    }

    private void applySettings() throws FileNotFoundException {
        settingsPath = getString("settings", "path");
        FileReader reader = new FileReader(settingsPath);
        settings = new Gson().fromJson(new JsonReader(reader), JsonObject.class);

        for (Map.Entry<String, JsonElement> entry : settings.entrySet()) {
            if (entry.getValue() instanceof JsonObject) {
                JsonObject settingsPart = (JsonObject) entry.getValue();
                JsonObject configPart = config.getAsJsonObject(entry.getKey());
                if (configPart == null) {
                    configPart = new JsonObject();
                    config.add(entry.getKey(), configPart);
                }
                for (Map.Entry<String, JsonElement> partEntry : settingsPart.entrySet()) {
                    configPart.add(partEntry.getKey(), partEntry.getValue());
                }
            }
            else if (entry.getValue() instanceof JsonArray) {
                JsonArray settingsPart = (JsonArray) entry.getValue();
                JsonArray configPart = new JsonArray();
                config.add(entry.getKey(), configPart);
                configPart.addAll(settingsPart);
            }
        }
        System.out.println("### ### ###");
        System.out.println("config in effect\n" + config);
    }

    public void writeSettings(JsonObject settings) {
        try {
            FileWriter writer = new FileWriter(settingsPath);
            writer.write(new GsonBuilder().setPrettyPrinting().create().toJson(settings));
            writer.close();
            this.settings = settings;
            applySettings();
            ScheduleManager.getInstance().rescheduleBackgroundJobs();
        }
        catch (IOException e) {
            e.printStackTrace();
        }
    }

    public JsonObject readSettings() {
        ensureConfig();
        return settings;
    }
}
