package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.apache.commons.io.IOUtils;
import studentsync.base.Configuration;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import static studentsync.domains.JSON.json;

/**
 * Created by holger on 1/9/14.
 */
public class SettingsServlet
    extends CorsServlet
{
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
    {
        try {
            String action = req.getParameter("action");
            if ("read".equals(action)) {
                JsonObject config = Configuration.getInstance().readSettings();
                writeObject(req, resp, config);
            }
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String action = req.getParameter("action");
            if ("write".equals(action)) {
                String json = IOUtils.toString(new InputStreamReader(req.getInputStream(), StandardCharsets.UTF_8));
                JsonObject config = new Gson().fromJson(json, JsonObject.class);
                Configuration.getInstance().writeSettings(config);
                writeObject(req, resp, config);
            }
        }
        catch (Exception e) {
            e.printStackTrace();
            sendError(req, resp, e);
        }
    }
}
