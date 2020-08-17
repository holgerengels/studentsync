package studentsync.domains;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import studentsync.base.Configuration;
import studentsync.base.Report;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collection;
import java.util.Map;

public class CorsServlet extends HttpServlet {
    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);
        ServletContext context = getServletContext();
        String configPath = context.getRealPath("/sync-config.json");
        log("config path: " + configPath);
        Configuration.getInstance().setConfigPath(configPath);
    }

    static void corsHeaders(HttpServletRequest request, HttpServletResponse resp) {
        String referer = getHeader(request, "referer");
        if (referer == null)
            referer = request.getParameter("referer");

	if (referer == null)
            throw new RuntimeException("referer header missing");

        int i = referer.indexOf("/", 9);
        if (i != -1)
            referer = referer.substring(0, i);

        System.out.println(referer);

        resp.setHeader("Access-Control-Allow-Origin", referer);
        resp.setHeader("Access-Control-Allow-Credentials", "true");
        resp.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD, PUT, POST");
        resp.setHeader("Access-Control-Allow-Headers", "Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token, X-Instance");
    }

    private static String getHeader(HttpServletRequest request, String name) {
        String value = request.getHeader(name);
        return value != null && value.length() != 0 ? value : null;
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse resp) {
        corsHeaders(request, resp);
    }

    protected void writeReport(HttpServletRequest req, HttpServletResponse resp, Report report) throws IOException {
        JsonArray jsonReport = new JsonArray();
        for (Map.Entry<String, Object> entry : report.entrySet()) {
            JsonObject line = new JsonObject();
            line.addProperty("key", entry.getKey());
            if (Collection.class.isAssignableFrom(entry.getValue().getClass()))
                line.addProperty("value", String.join(", ", (Collection) entry.getValue()));
            else
                line.addProperty("value", "" + entry.getValue());
            jsonReport.add(line);
        }
        writeObject(req, resp, jsonReport);
    }

    protected void writeObject(HttpServletRequest req, HttpServletResponse resp, JsonElement object) throws IOException {
        corsHeaders(req, resp);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("utf-8");
        resp.getWriter().print(object.toString());
    }

    void sendError(HttpServletRequest req, HttpServletResponse resp, Exception e) throws IOException {
        corsHeaders(req, resp);
        resp.setStatus(500);
        resp.setContentType("text/plain");
        resp.setCharacterEncoding("utf-8");
        resp.getWriter().print(e.getMessage());
    }
}
