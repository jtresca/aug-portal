using UnityEngine;
using System.Runtime.InteropServices;

public class AUG_Handshake : MonoBehaviour
{
    // Imports the .jslib functions
    [DllImport("__Internal")]
    private static extern void AUG_RequestIdentity();

    // The stored JWT token
    [Header("AUG Session Data")]
    public string AUG_Player_ID;

    void Start()
    {
        // Start the identity handshake on startup
        RequestIdentity();
    }

    public void RequestIdentity()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        AUG_RequestIdentity();
#else
        Debug.Log("[AUG] Identity handshake can only be performed in WebGL builds.");
#endif
    }

    // This method is called by the SDK Bridge (JS layer)
    public void OnIdentityReceived(string jwtToken)
    {
        Debug.Log("[AUG] Handshake Received! JWT Stored.");
        AUG_Player_ID = jwtToken;
        
        // At this point, you can send the JWT to your dedicated game server
        // for verification and user data retrieval.
        OnHandshakeComplete(jwtToken);
    }

    public void OnIdentityError(string errorMessage)
    {
        Debug.LogError("[AUG] Handshake Failed: " + errorMessage);
        // Handle login requirement or error UI here
    }

    private void OnHandshakeComplete(string jwt)
    {
        // Broadcast event or update game state
        Debug.Log("Game character should now load for user associated with token: " + jwt.Substring(0, 10) + "...");
    }
}
