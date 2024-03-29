package studentsync.base;

import com.google.gson.JsonObject;

import javax.net.ssl.*;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;

public class ExtendedTrustManager
    implements X509TrustManager
{
    public static ExtendedTrustManager INSTANCE;

    public static synchronized ExtendedTrustManager getInstance(JsonObject config) {
        if (INSTANCE == null) {
            try {
                System.out.println("Loading KeyStore from " + config.getAsJsonObject("ldap").get("trustStore").getAsString());
                FileInputStream myKeys = new FileInputStream(config.getAsJsonObject("ldap").get("trustStore").getAsString());
                KeyStore myTrustStore = KeyStore.getInstance(KeyStore.getDefaultType());
                myTrustStore.load(myKeys, config.getAsJsonObject("ldap").get("trustStorePassword").getAsString().toCharArray());
                myKeys.close();
                System.out.println("Done loading KeyStore from " + config.getAsJsonObject("ldap").get("trustStore").getAsString());

                TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                tmf.init(myTrustStore);

                X509TrustManager myTm = null;
                for (TrustManager tm : tmf.getTrustManagers()) {
                    if (tm instanceof X509TrustManager) {
                        myTm = (X509TrustManager)tm;
                        break;
                    }
                }

                // Get hold of the default trust manager
                X509TrustManager defaultTm = null;
                for (TrustManager tm : tmf.getTrustManagers()) {
                    if (tm instanceof X509TrustManager) {
                        defaultTm = (X509TrustManager)tm;
                        break;
                    }
                }

                final X509TrustManager finalDefaultTm = defaultTm;
                final X509TrustManager finalMyTm = myTm;

                System.out.println("SSLContext.getDefault().getProtocol() = " + SSLContext.getDefault().getProtocol());
                SSLContext sslContext = SSLContext.getInstance("SSL");
                sslContext.init(null, new TrustManager[] { INSTANCE }, new java.security.SecureRandom());
                SSLContext.setDefault(sslContext);
                System.out.println("Extended TrustManager installed successfully");

                INSTANCE = new ExtendedTrustManager(finalDefaultTm, finalMyTm);
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
            if ("CN=DC01.musterschule.schule.paedml".equals(chain[0].getSubjectDN().toString()))
                return;

            System.out.println("TRUSTMANAGER MY " + authType);
            finalMyTm.checkServerTrusted(chain, authType);
            System.out.println("TRUSTMANAGER MY OK");
        }
        catch (CertificateException e) {
            //finalDefaultTm.checkServerTrusted(chain, authType);
        }
    }

    @Override
    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
        finalDefaultTm.checkClientTrusted(chain, authType);
    }
}
