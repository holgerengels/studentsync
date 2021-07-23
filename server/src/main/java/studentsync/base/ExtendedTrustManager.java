package studentsync.base;

import com.google.gson.JsonObject;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.Map;

public class ExtendedTrustManager
    implements X509TrustManager
{
    private static ExtendedTrustManager INSTANCE;

    public static synchronized ExtendedTrustManager getInstance(JsonObject config) {
        if (INSTANCE == null) {
            try {
                TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                tmf.init((KeyStore)null);

                // Get hold of the default trust manager
                X509TrustManager defaultTm = null;
                for (TrustManager tm : tmf.getTrustManagers()) {
                    if (tm instanceof X509TrustManager) {
                        defaultTm = (X509TrustManager)tm;
                        break;
                    }
                }

                System.out.println("Loading KeyStore from " + config.getAsJsonObject("ldap").get("trustStore").getAsString());
                FileInputStream myKeys = new FileInputStream(config.getAsJsonObject("ldap").get("trustStore").getAsString());
                KeyStore myTrustStore = KeyStore.getInstance(KeyStore.getDefaultType());
                myTrustStore.load(myKeys, config.getAsJsonObject("ldap").get("trustStorePassword").getAsString().toCharArray());
                myKeys.close();
                System.out.println("Done loading KeyStore from " + config.getAsJsonObject("ldap").get("trustStore").getAsString());

                tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                tmf.init(myTrustStore);

                X509TrustManager myTm = null;
                for (TrustManager tm : tmf.getTrustManagers()) {
                    if (tm instanceof X509TrustManager) {
                        myTm = (X509TrustManager)tm;
                        break;
                    }
                }

                final X509TrustManager finalDefaultTm = defaultTm;
                final X509TrustManager finalMyTm = myTm;

                INSTANCE = new ExtendedTrustManager(finalDefaultTm, finalMyTm);

                SSLContext sslContext = SSLContext.getInstance("TLS");
                sslContext.init(null, new TrustManager[] { INSTANCE }, null);
                SSLContext.setDefault(sslContext);
                System.out.println("Extended TrustManager installed successfully");
            }
            catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
        return INSTANCE;
    }

    private final X509TrustManager finalDefaultTm;
    private final X509TrustManager finalMyTm;

    public ExtendedTrustManager(X509TrustManager finalDefaultTm, X509TrustManager finalMyTm) {
        this.finalDefaultTm = finalDefaultTm;
        this.finalMyTm = finalMyTm;
    }

    @Override
    public X509Certificate[] getAcceptedIssuers() {
        return finalDefaultTm.getAcceptedIssuers();
    }

    @Override
    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        try {
            System.out.println("TRUSTMANAGER MY type: " + authType + ", chain: " + Arrays.asList(chain));
            finalMyTm.checkServerTrusted(chain, authType);
            System.out.println("OK");
        }
        catch (CertificateException e) {
            System.out.println("TRUSTMANAGER DEF type: " + authType + ", chain: " + Arrays.asList(chain));
            finalDefaultTm.checkServerTrusted(chain, authType);
            System.out.println("OK");
        }
    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        finalDefaultTm.checkClientTrusted(chain, authType);
    }
}
